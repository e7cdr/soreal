"""API views that generate PDF fact sheets and brochures for estates."""

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from estates.models import Property
from estates.pdf_exports import build_estates_pdf, pdf_filename

PUBLIC_STATUSES = ("available", "reserved")
VALID_LAYOUTS = ("factsheet", "brochure")
VALID_LANGUAGES = ("en", "es")
MAX_BULK_ESTATES = 50


def _public_queryset(user):
    queryset = Property.objects.select_related("broker").prefetch_related("images")
    if not user.is_staff:
        queryset = queryset.filter(status__in=PUBLIC_STATUSES)
    return queryset


def _options(request):
    layout = request.query_params.get("layout", "factsheet")
    if layout not in VALID_LAYOUTS:
        layout = "factsheet"
    language = request.query_params.get("lang", "en")
    if language not in VALID_LANGUAGES:
        language = "en"
    return layout, language


class EstatePdfView(APIView):
    """Download a fact sheet or brochure for one estate."""

    permission_classes = [AllowAny]

    def get(self, request, slug):
        property = get_object_or_404(_public_queryset(request.user), slug=slug)
        layout, language = _options(request)
        buffer = build_estates_pdf([property], layout=layout, language=language)
        response = HttpResponse(buffer.getvalue(), content_type="application/pdf")
        response["Content-Disposition"] = (
            f'attachment; filename="{pdf_filename([property], layout)}"'
        )
        response["Cache-Control"] = "private, no-store"
        return response


class BulkEstatePdfView(APIView):
    """Download a combined PDF for a set of selected estates."""

    permission_classes = [AllowAny]

    def get(self, request):
        raw_ids = request.query_params.get("ids", "")
        ids = []
        for chunk in raw_ids.split(","):
            chunk = chunk.strip()
            if chunk.isdigit():
                ids.append(int(chunk))
        ids = list(dict.fromkeys(ids))

        if not ids:
            return Response(
                {"detail": "Select at least one estate."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(ids) > MAX_BULK_ESTATES:
            return Response(
                {
                    "detail": (
                        f"Select up to {MAX_BULK_ESTATES} estates per PDF."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        layout, language = _options(request)
        queryset = _public_queryset(request.user).filter(id__in=ids)
        by_id = {property.id: property for property in queryset}
        properties = [by_id[property_id] for property_id in ids if property_id in by_id]

        if not properties:
            return Response(
                {"detail": "No accessible estates were found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        buffer = build_estates_pdf(properties, layout=layout, language=language)
        response = HttpResponse(buffer.getvalue(), content_type="application/pdf")
        response["Content-Disposition"] = (
            f'attachment; filename="{pdf_filename(properties, layout)}"'
        )
        response["Cache-Control"] = "private, no-store"
        return response
