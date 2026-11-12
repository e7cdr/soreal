import csv
import hashlib
import io
import re
from django.http import HttpResponse
from django.conf import settings
from django.db.models import Case, CharField, Count, F, Q, Value, When
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import (
    SAFE_METHODS,
    AllowAny,
    BasePermission,
    IsAdminUser,
    IsAuthenticated,
)
from rest_framework.response import Response

from .models import (
    Property,
    PropertyInquiry,
    TenantApplication,
    SavedSearch,
    Lead,
    LeadMatch,
    Broker,
    Owner,
    ScanInboxItem,
    WhatsAppIgnoredUser,
    Project,
    ProjectUnit,
)
from .serializers import (
    PropertySerializer,
    PropertyInquirySerializer,
    TenantApplicationSerializer,
    SavedSearchSerializer,
    LeadSerializer,
    LeadMatchSerializer,
    BrokerSerializer,
    OwnerSerializer,
    ScanInboxItemSerializer,
    ProjectSerializer,
    ProjectUnitSerializer,
)
from .matching import create_matches_for_lead, create_matches_for_property


def _is_staff(request):
    return (
        request.user
        and request.user.is_authenticated
        and request.user.is_staff
    )


class IsStaffOrReadOnly(BasePermission):
    """Public read-only access; any write requires an authenticated staff user."""

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return bool(_is_staff(request))


def _safe_spreadsheet_value(value):
    if value is None:
        return ""
    if isinstance(value, str) and value.startswith(("=", "+", "-", "@")):
        return f"'{value}"
    return value


class PropertyViewSet(viewsets.ModelViewSet):
    """
    API for property listings.

    Public users only see available/reserved properties.
    Staff users see all properties.

    When a new property is created, it is automatically matched
    against existing leads.
    """

    queryset = Property.objects.prefetch_related("images__image")
    serializer_class = PropertySerializer
    permission_classes = [IsStaffOrReadOnly]
    lookup_field = "slug"

    filterset_fields = ["property_type", "listing_type", "status", "city", "featured"]
    search_fields = ["title", "address", "city", "province", "description"]
    ordering_fields = ["created_at", "price", "title", "bedrooms", "area_sqm"]
    ordering = ["-created_at"]

    def get_queryset(self):
        queryset = super().get_queryset()

        user = self.request.user
        is_staff = _is_staff(self.request)
        if not is_staff:
            queryset = queryset.filter(status__in=["available", "reserved"])

        q = self.request.query_params.get("q", None)
        min_price = self.request.query_params.get("min_price", None)
        max_price = self.request.query_params.get("max_price", None)
        bedrooms = self.request.query_params.get("bedrooms", None)

        if q:
            queryset = queryset.filter(
                Q(title__icontains=q)
                | Q(address__icontains=q)
                | Q(city__icontains=q)
                | Q(description__icontains=q)
            )

        if min_price:
            queryset = queryset.filter(price__gte=min_price)

        if max_price:
            queryset = queryset.filter(price__lte=max_price)

        if bedrooms:
            queryset = queryset.filter(bedrooms__gte=bedrooms)

        return queryset

    def perform_create(self, serializer):
        property = serializer.save()
        # Auto-match against existing leads
        from .matching import create_matches_for_property

        create_matches_for_property(property)


class PropertyInquiryViewSet(viewsets.ModelViewSet):
    """
    API for property inquiries.

    Public users can CREATE inquiries.
    Staff can LIST and UPDATE inquiry status and screening.
    """

    queryset = PropertyInquiry.objects.select_related("matched_person")
    serializer_class = PropertyInquirySerializer

    def get_permissions(self):
        if self.action in ("create",):
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        is_staff = _is_staff(self.request)
        if not is_staff:
            return PropertyInquiry.objects.none()
        return super().get_queryset()

    def perform_create(self, serializer):
        inquiry = serializer.save()

        # Auto-screen against blacklist if identification provided
        identification = inquiry.identification
        if identification:
            from blacklist.models import BlacklistedPerson

            match = BlacklistedPerson.objects.filter(
                identification=identification
            ).first()
            if match:
                inquiry.screening_status = "flagged"
                inquiry.matched_person = match
                inquiry.screening_notes = (
                    f"Matched blacklist record {match.case_id}: {match.full_name}"
                )
            else:
                inquiry.screening_status = "clean"
                inquiry.screening_notes = "No blacklist match found."
            inquiry.save()

        # Notify staff about new inquiry
        admin_emails = getattr(__import__("django.conf", fromlist=["settings"]).settings, "ADMIN_EMAILS", [])
        if admin_emails:
            from django.core.mail import send_mail

            send_mail(
                subject=f"[SOREAL] New Property Inquiry - {inquiry.property.title}",
                message=(
                    f"A new property inquiry has been received.\n\n"
                    f"Property: {inquiry.property.title}\n"
                    f"Name: {inquiry.name}\n"
                    f"Email: {inquiry.email}\n"
                    f"Phone: {inquiry.phone or 'Not provided'}\n"
                    f"ID Type: {inquiry.id_type or 'Not provided'}\n"
                    f"ID Number: {inquiry.identification or 'Not provided'}\n"
                    f"Screening: {inquiry.get_screening_status_display()}\n"
                    f"Message: {inquiry.message or 'No message'}\n\n"
                    f"Review at: {__import__('django.conf', fromlist=['settings']).settings.WAGTAILADMIN_BASE_URL}/admin/estates/propertyinquiry/"
                ),
                from_email=__import__("django.conf", fromlist=["settings"]).settings.DEFAULT_FROM_EMAIL,
                recipient_list=admin_emails,
                fail_silently=True,
            )

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def screen(self, request, pk=None):
        """Manually run blacklist screening on an inquiry."""
        inquiry = self.get_object()

        if not _is_staff(request):
            return Response(
                {"detail": "Staff access required."},
                status=status.HTTP_403_FORBIDDEN,
            )

        identification = inquiry.identification
        if not identification:
            return Response(
                {"detail": "No identification number on this inquiry."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from blacklist.models import BlacklistedPerson

        match = BlacklistedPerson.objects.filter(
            identification=identification
        ).first()

        inquiry.screened_by = request.user.username
        inquiry.screened_at = timezone.now()

        if match:
            inquiry.screening_status = "flagged"
            inquiry.matched_person = match
            inquiry.screening_notes = (
                f"Matched blacklist record {match.case_id}: {match.full_name}"
            )
        else:
            inquiry.screening_status = "clean"
            inquiry.matched_person = None
            inquiry.screening_notes = "No blacklist match found."

        inquiry.save()

        return Response(
            {
                "detail": "Screening complete.",
                "screening_status": inquiry.screening_status,
                "matched_person_case_id": match.case_id if match else None,
                "matched_person_name": match.full_name if match else None,
            }
        )

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def create_application(self, request, pk=None):
        """Create a TenantApplication from an inquiry."""
        inquiry = self.get_object()

        if not _is_staff(request):
            return Response(
                {"detail": "Staff access required."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if hasattr(inquiry, "application"):
            return Response(
                {"detail": "Application already exists for this inquiry."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        application = TenantApplication.objects.create(
            inquiry=inquiry,
            blacklisted_person=inquiry.matched_person,
            screening_status=inquiry.screening_status,
            screening_notes=inquiry.screening_notes,
        )

        serializer = TenantApplicationSerializer(application)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class TenantApplicationViewSet(viewsets.ModelViewSet):
    """
    API for tenant applications.

    Staff can list, view, update decisions on applications.
    """

    queryset = TenantApplication.objects.select_related("inquiry__property")
    serializer_class = TenantApplicationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if not _is_staff(self.request):
            return TenantApplication.objects.none()
        return super().get_queryset()

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def decide(self, request, pk=None):
        """Approve or reject a tenant application."""
        application = self.get_object()

        if not _is_staff(request):
            return Response(
                {"detail": "Staff access required."},
                status=status.HTTP_403_FORBIDDEN,
            )

        decision = request.data.get("decision")
        decision_notes = request.data.get("decision_notes", "")

        if decision not in ["approved", "rejected"]:
            return Response(
                {"detail": "Decision must be 'approved' or 'rejected'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        application.decision = decision
        application.decision_notes = decision_notes
        application.decided_by = request.user.username
        application.decided_at = timezone.now()
        application.save()

        # Also update inquiry status
        inquiry = application.inquiry
        if decision == "approved":
            inquiry.status = "contacted"
        else:
            inquiry.status = "closed"
        inquiry.save()

        serializer = TenantApplicationSerializer(application)
        return Response(serializer.data)


class SavedSearchViewSet(viewsets.ModelViewSet):
    """
    API for saved property searches.

    Authenticated users can create and list their saved searches.
    """

    queryset = SavedSearch.objects.all()
    serializer_class = SavedSearchSerializer

    def get_permissions(self):
        if self.action in ("create",):
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        if not _is_staff(self.request):
            return SavedSearch.objects.none()
        return super().get_queryset()

    @action(detail=True, methods=["get"], permission_classes=[AllowAny])
    def matches(self, request, pk=None):
        """Get properties matching this saved search's filters."""
        search = self.get_object()
        filters = search.filters or {}

        queryset = Property.objects.filter(status__in=["available", "reserved"])

        q = filters.get("q")
        if q:
            queryset = queryset.filter(
                Q(title__icontains=q)
                | Q(address__icontains=q)
                | Q(city__icontains=q)
            )

        property_type = filters.get("property_type")
        if property_type:
            queryset = queryset.filter(property_type=property_type)

        listing_type = filters.get("listing_type")
        if listing_type:
            queryset = queryset.filter(listing_type=listing_type)

        city = filters.get("city")
        if city:
            queryset = queryset.filter(city__icontains=city)

        min_price = filters.get("min_price")
        if min_price:
            queryset = queryset.filter(price__gte=min_price)

        max_price = filters.get("max_price")
        if max_price:
            queryset = queryset.filter(price__lte=max_price)

        bedrooms = filters.get("bedrooms")
        if bedrooms:
            queryset = queryset.filter(bedrooms__gte=bedrooms)

        serializer = PropertySerializer(queryset, many=True, context={"request": request})
        return Response(serializer.data)


class LeadViewSet(viewsets.ModelViewSet):
    """
    API for leads from WhatsApp groups or manual entry.

    Public users can CREATE leads.
    Staff can LIST and UPDATE leads.
    When a lead is created, it is automatically matched
    against existing properties.
    """

    queryset = Lead.objects.all()
    serializer_class = LeadSerializer

    def get_permissions(self):
        if self.action in ("create",):
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        if not _is_staff(self.request):
            return Lead.objects.none()
        return self._filtered_queryset()

    ordering_fields = [
        "created_at",
        "name",
        "phone",
        "created_property__title",
        "property_type",
        "listing_type",
        "city",
        "province",
        "status",
        "min_price",
        "max_price",
    ]
    ordering = ["-created_at"]

    def _filtered_queryset(self):
        queryset = super().get_queryset().select_related("broker", "created_property")
        params = self.request.query_params
        lead_status = params.get("status")
        if lead_status == "open":
            queryset = queryset.filter(status__in=["new", "contacted", "matched"])
        elif lead_status == "completed":
            queryset = queryset.filter(status__in=["completed", "closed"])
        elif lead_status and lead_status != "all":
            queryset = queryset.filter(status=lead_status)

        query = params.get("q", "").strip()
        if query:
            queryset = queryset.filter(
                Q(name__icontains=query)
                | Q(phone__icontains=query)
                | Q(source_sender__icontains=query)
                | Q(whatsapp_group__icontains=query)
                | Q(notes__icontains=query)
                | Q(preferred_location__icontains=query)
                | Q(broker__name__icontains=query)
                | Q(broker__company__icontains=query)
            )

        property_type = params.get("property_type")
        if property_type:
            queryset = queryset.filter(property_type=property_type)
        listing_type = params.get("listing_type")
        if listing_type:
            queryset = queryset.filter(listing_type=listing_type)
        location = params.get("location", "").strip()
        if location:
            queryset = queryset.filter(
                Q(preferred_location__icontains=location)
                | Q(city__icontains=location)
                | Q(province__icontains=location)
            )
        bedrooms = params.get("bedrooms")
        if bedrooms:
            if not bedrooms.isdigit():
                return queryset.none()
            bedroom_count = int(bedrooms)
            queryset = queryset.filter(
                (Q(min_bedrooms__isnull=True) | Q(min_bedrooms__lte=bedroom_count))
                & (Q(max_bedrooms__isnull=True) | Q(max_bedrooms__gte=bedroom_count))
            )

        ordering = params.get("ordering")
        if ordering:
            valid_fields = set(self.ordering_fields)
            # Strip leading '-' for validation.
            field = ordering.lstrip("-")
            if field in valid_fields:
                queryset = queryset.order_by(ordering)
        return queryset

    @action(detail=False, methods=["get"])
    def summary(self, request):
        if not _is_staff(request):
            return Response({"detail": "Staff access required."}, status=403)
        queryset = self._filtered_queryset()
        by_type = queryset.values("property_type").annotate(count=Count("id")).order_by("-count")
        bedroom_groups = (
            queryset.values("min_bedrooms", "max_bedrooms")
            .annotate(count=Count("id"))
            .order_by("min_bedrooms", "max_bedrooms")
        )
        broker_stats = (
            Broker.objects.annotate(
                request_count=Count(
                    "requests",
                    filter=~Q(requests__status="ignored"),
                    distinct=True,
                ),
                property_count=Count("properties", distinct=True),
            )
            .filter(Q(request_count__gt=0) | Q(property_count__gt=0))
            .order_by("-property_count", "-request_count", "name")[:10]
        )
        return Response({
            "total": queryset.count(),
            "by_status": list(queryset.values("status").annotate(count=Count("id")).order_by("status")),
            "by_property_type": list(by_type),
            "by_bedrooms": [
                {
                    "min": item["min_bedrooms"],
                    "max": item["max_bedrooms"],
                    "count": item["count"],
                }
                for item in bedroom_groups
            ],
            "top_property_type": by_type.first(),
            "top_brokers": BrokerSerializer(broker_stats, many=True).data,
        })

    @action(detail=False, methods=["get"])
    def duplicates(self, request):
        if not _is_staff(request):
            return Response({"detail": "Staff access required."}, status=403)

        from collections import defaultdict

        def _phone_digits(value):
            return re.sub(r"\D", "", value or "")

        leads = list(self._filtered_queryset().only("id", "name", "phone", "status", "created_at", "broker"))
        groups = defaultdict(list)
        for lead in leads:
            key = _phone_digits(lead.phone) or "name:" + lead.name.strip().lower()
            groups[key].append(lead)

        duplicate_groups = []
        for key, items in groups.items():
            if len(items) > 1:
                duplicate_groups.append({
                    "key": key,
                    "count": len(items),
                    "leads": [
                        {
                            "id": item.id,
                            "name": item.name,
                            "phone": item.phone or "",
                            "status": item.status,
                            "created_at": item.created_at.isoformat() if item.created_at else None,
                            "broker_id": item.broker_id,
                        }
                        for item in sorted(items, key=lambda x: x.created_at or x.id, reverse=True)
                    ],
                })

        duplicate_groups.sort(key=lambda g: g["count"], reverse=True)
        return Response({
            "total_groups": len(duplicate_groups),
            "total_duplicate_leads": sum(g["count"] for g in duplicate_groups),
            "groups": duplicate_groups,
        })

    @action(detail=False, methods=["get"])
    def export(self, request):
        if not _is_staff(request):
            return Response({"detail": "Staff access required."}, status=403)
        leads = self._filtered_queryset().order_by("-created_at")
        headers = [
            "ID", "Requester", "Phone", "WhatsApp sender", "Broker", "Broker company",
            "Estate ID", "Estate title", "Estate status", "Status", "Listing type",
            "Property type", "Min bedrooms", "Max bedrooms",
            "Min bathrooms", "Max bathrooms", "Min budget", "Max budget", "Currency",
            "Preferred location", "City", "Province", "Furnishing", "Source", "Group",
            "Original request", "Created at",
        ]
        rows = [
            [
                lead.id, lead.name, lead.phone, lead.source_sender,
                lead.broker.name if lead.broker else "",
                lead.broker.company if lead.broker else "",
                lead.created_property.id if hasattr(lead, "created_property") else "",
                lead.created_property.title if hasattr(lead, "created_property") else "",
                lead.created_property.status if hasattr(lead, "created_property") else "",
                lead.status, lead.listing_type, lead.property_type or "",
                lead.min_bedrooms, lead.max_bedrooms, lead.min_bathrooms,
                lead.max_bathrooms, lead.min_price, lead.max_price,
                lead.budget_currency or "", lead.preferred_location or "",
                lead.city or "", lead.province or "", lead.furnishing or "",
                lead.source, lead.whatsapp_group or "", lead.notes or "",
                lead.created_at.isoformat(),
            ]
            for lead in leads
        ]
        export_format = request.query_params.get("file_format", "csv").lower()
        if export_format == "xlsx":
            from openpyxl import Workbook

            workbook = Workbook()
            sheet = workbook.active
            sheet.title = "Requests"
            sheet.append(headers)
            for row in rows:
                sheet.append([_safe_spreadsheet_value(value) for value in row])
            output = io.BytesIO()
            workbook.save(output)
            response = HttpResponse(
                output.getvalue(),
                content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
            response["Content-Disposition"] = 'attachment; filename="soreal_requests.xlsx"'
            return response
        if export_format != "csv":
            return Response({"detail": "file_format must be csv or xlsx."}, status=400)

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(headers)
        writer.writerows([_safe_spreadsheet_value(value) for value in row] for row in rows)
        response = HttpResponse("\ufeff" + output.getvalue(), content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="soreal_requests.csv"'
        return response

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def ignore_user(self, request, pk=None):
        lead = self.get_object()
        if lead.source != "whatsapp":
            return Response(
                {"detail": "Only WhatsApp senders can be ignored."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        from .whatsapp_parser import normalize_whatsapp_sender

        sender = lead.source_sender or lead.name
        sender_key = normalize_whatsapp_sender(sender)
        if not sender_key:
            return Response(
                {"detail": "This request has no sender identity to ignore."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        WhatsAppIgnoredUser.objects.update_or_create(
            sender_key=sender_key,
            defaults={"sender_name": sender[:200]},
        )
        sender_leads = (
            Lead.objects.filter(source="whatsapp", source_sender=lead.source_sender)
            if lead.source_sender
            else Lead.objects.filter(source="whatsapp", source_sender="", name=lead.name)
        )
        sender_leads.exclude(status="ignored").update(
            status_before_ignored=F("status"),
            status="ignored",
        )
        Lead.objects.filter(pk=lead.pk).exclude(status="ignored").update(
            status_before_ignored=F("status"),
            status="ignored",
        )
        return Response({"detail": "Sender ignored.", "sender_key": sender_key})

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def unignore_user(self, request, pk=None):
        lead = self.get_object()
        if lead.source != "whatsapp":
            return Response(
                {"detail": "Only WhatsApp senders can be unignored."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        from .whatsapp_parser import normalize_whatsapp_sender

        sender = lead.source_sender or lead.name
        sender_key = normalize_whatsapp_sender(sender)
        deleted, _ = WhatsAppIgnoredUser.objects.filter(sender_key=sender_key).delete()
        sender_leads = (
            Lead.objects.filter(source="whatsapp", source_sender=lead.source_sender)
            if lead.source_sender
            else Lead.objects.filter(source="whatsapp", source_sender="", name=lead.name)
        )
        sender_leads.filter(status="ignored").update(
            status=Case(
                When(status_before_ignored="", then=Value("new")),
                default=F("status_before_ignored"),
                output_field=CharField(),
            ),
            status_before_ignored="",
        )
        return Response({"detail": "Sender unignored.", "removed": deleted})

    @action(detail=True, methods=["post"])
    def create_estate(self, request, pk=None):
        lead = self.get_object()
        if hasattr(lead, "created_property"):
            return Response(
                {
                    "detail": "An estate was already created from this request.",
                    "property_id": lead.created_property.id,
                },
                status=status.HTTP_409_CONFLICT,
            )

        serializer = PropertySerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        estate = serializer.save(source_lead=lead)
        create_matches_for_property(estate)
        return Response(PropertySerializer(estate, context={"request": request}).data, status=status.HTTP_201_CREATED)

    def perform_create(self, serializer):
        lead = serializer.save()
        # Auto-match against existing properties
        create_matches_for_lead(lead)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def match(self, request, pk=None):
        """Re-run matching for this lead against all properties."""
        lead = self.get_object()
        from .matching import find_matches_for_lead

        matches = find_matches_for_lead(lead)
        created = []

        for prop, score, reasons in matches:
            match, created_flag = LeadMatch.objects.get_or_create(
                lead=lead,
                property=prop,
                defaults={
                    "match_score": score,
                    "match_reasons": reasons,
                    "status": "pending",
                },
            )
            if created_flag:
                created.append(match)

        return Response(
            {
                "detail": f"Re-matching complete. {len(created)} new match(es) found.",
                "new_matches": len(created),
            }
        )


class BrokerViewSet(viewsets.ModelViewSet):
    """Staff-managed directory of brokers and reusable requester contacts."""

    serializer_class = BrokerSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if not _is_staff(self.request):
            return Broker.objects.none()
        queryset = Broker.objects.annotate(
            request_count=Count("requests", distinct=True),
            property_count=Count("properties", distinct=True),
        )
        query = self.request.query_params.get("q", "").strip()
        if query:
            queryset = queryset.filter(
                Q(name__icontains=query)
                | Q(phone__icontains=query)
                | Q(email__icontains=query)
                | Q(company__icontains=query)
            )
        return queryset.order_by("name")

    def perform_create(self, serializer):
        if not _is_staff(self.request):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Staff access required.")
        serializer.save()


class OwnerViewSet(viewsets.ModelViewSet):
    serializer_class = OwnerSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if not _is_staff(self.request):
            return Owner.objects.none()
        queryset = Owner.objects.annotate(
            property_count=Count("properties", distinct=True),
            project_count=Count("projects", distinct=True),
        )
        query = self.request.query_params.get("q", "").strip()
        if query:
            queryset = queryset.filter(
                Q(name__icontains=query)
                | Q(phone__icontains=query)
                | Q(email__icontains=query)
                | Q(company__icontains=query)
                | Q(identification__icontains=query)
            )
        return queryset.order_by("name")

    def perform_create(self, serializer):
        if not _is_staff(self.request):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Staff access required.")
        serializer.save()


class DataQualityViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=["get"])
    def summary(self, request):
        if not _is_staff(request):
            return Response({"detail": "Staff access required."}, status=403)

        checks = [
            (
                "estate",
                Property.objects.select_related("broker", "owner").order_by("-updated_at"),
                {"title": "title", "city": "city", "province": "province", "price": "price", "broker": "broker", "owner": "owner"},
                "/estates/",
                Q(title="") | Q(city__isnull=True) | Q(city="") | Q(province__isnull=True) | Q(province="") | Q(price__isnull=True) | Q(broker__isnull=True) | Q(owner__isnull=True),
            ),
            (
                "project",
                Project.objects.select_related("broker", "owner").order_by("-updated_at"),
                {"city": "city", "province": "province", "broker": "broker", "owner": "owner"},
                "/projects/?record=",
                Q(city__isnull=True) | Q(city="") | Q(province__isnull=True) | Q(province="") | Q(broker__isnull=True) | Q(owner__isnull=True),
            ),
            (
                "request",
                Lead.objects.select_related("broker").order_by("-updated_at"),
                {"phone": "phone", "property_type": "propertyType", "min_bedrooms": "bedrooms", "preferred_location": "location", "broker": "broker"},
                "/requests/",
                Q(phone="") | Q(property_type__isnull=True) | Q(property_type="") | Q(min_bedrooms__isnull=True) | Q(preferred_location="") | Q(broker__isnull=True),
            ),
            (
                "broker",
                Broker.objects.order_by("name"),
                {"phone": "phone", "email": "email", "company": "company"},
                "/brokers/?record=",
                Q(phone="") | Q(email="") | Q(company=""),
            ),
            (
                "owner",
                Owner.objects.order_by("name"),
                {"phone": "phone", "email": "email"},
                "/owners/?record=",
                Q(phone="") | Q(email=""),
            ),
        ]
        totals = {}
        records = []
        for entity, queryset, fields, path, incomplete_filter in checks:
            totals[entity] = queryset.filter(incomplete_filter).count()
            for record in queryset.filter(incomplete_filter)[:250]:
                missing = [
                    label for field, label in fields.items()
                    if not getattr(record, field)
                ]
                records.append({
                    "entity": entity,
                    "id": record.pk,
                    "name": getattr(record, "title", None) or getattr(record, "name", None),
                    "missing_fields": missing,
                    "url": f"{path}{getattr(record, 'slug', record.pk)}",
                })
        return Response({"incomplete_counts": totals, "records": records})


class LeadMatchViewSet(viewsets.ModelViewSet):
    """
    API for lead-property matches.

    Staff can LIST, VIEW, and UPDATE match status
    (pending, notified, contacted, dismissed).
    """

    queryset = LeadMatch.objects.select_related("lead", "property")
    serializer_class = LeadMatchSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if not _is_staff(self.request):
            return LeadMatch.objects.none()
        return super().get_queryset()

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def notify(self, request, pk=None):
        """Mark a match as notified."""
        match = self.get_object()
        match.status = "notified"
        match.notified_at = timezone.now()
        match.save()
        serializer = LeadMatchSerializer(match)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def dismiss(self, request, pk=None):
        """Dismiss a match."""
        match = self.get_object()
        match.status = "dismissed"
        match.save()
        serializer = LeadMatchSerializer(match)
        return Response(serializer.data)


class ProjectViewSet(viewsets.ModelViewSet):
    """
    API for real estate development projects.
    Staff can create and manage projects with multiple units.
    """

    queryset = Project.objects.annotate(
        unit_count=Count("units"),
        available_count=Count(
            "units", filter=Q(units__status="available")
        ),
        sold_count=Count(
            "units", filter=Q(units__status__in=["sold", "rented"])
        ),
    ).order_by("-created_at")
    serializer_class = ProjectSerializer
    permission_classes = [IsAdminUser]
    lookup_field = "slug"

    def get_queryset(self):
        queryset = super().get_queryset()
        status = self.request.query_params.get("status", None)
        city = self.request.query_params.get("city", None)
        if status:
            queryset = queryset.filter(status=status)
        if city:
            queryset = queryset.filter(city__icontains=city)
        return queryset


class ProjectUnitViewSet(viewsets.ModelViewSet):
    """
    API for individual units within projects.
    Staff can create, update, and manage units.
    Supports bulk creation via the 'bulk_create' action.
    """

    queryset = ProjectUnit.objects.all()
    serializer_class = ProjectUnitSerializer
    permission_classes = [IsStaffOrReadOnly]

    def get_queryset(self):
        queryset = super().get_queryset()
        project = self.request.query_params.get("project", None)
        status = self.request.query_params.get("status", None)
        if project:
            if project.isdecimal():
                queryset = queryset.filter(project_id=project)
            else:
                queryset = queryset.filter(project__slug=project)
        if status:
            queryset = queryset.filter(status=status)
        return queryset

    @action(detail=False, methods=["post"], permission_classes=[IsAdminUser])
    def bulk_create(self, request):
        """Bulk create multiple units for a project."""
        project_id = request.data.get("project")
        units_data = request.data.get("units", [])

        if not project_id:
            return Response(
                {"detail": "Project ID is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            project = (
                Project.objects.get(pk=project_id)
                if str(project_id).isdecimal()
                else Project.objects.get(slug=project_id)
            )
        except Project.DoesNotExist:
            return Response(
                {"detail": "Project not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        created_units = []
        errors = []

        for i, unit_data in enumerate(units_data):
            serializer = ProjectUnitSerializer(
                data={**unit_data, "project": project.id}
            )
            if serializer.is_valid():
                serializer.save()
                created_units.append(serializer.data)
            else:
                errors.append({"unit_index": i, "errors": serializer.errors})

        # Update project totals
        project.total_units = project.units.count()
        project.available_units = project.units.filter(
            status="available"
        ).count()
        project.save()

        return Response(
            {
                "detail": f"Bulk creation complete. {len(created_units)} units created.",
                "created_units": created_units,
                "errors": errors,
            },
            status=status.HTTP_201_CREATED if not errors else status.HTTP_207_MULTI_STATUS,
        )


class AnalyticsViewSet(viewsets.ViewSet):
    """
    API for dashboard analytics and reporting.
    Staff can access price trends, request volume, conversion funnels,
    category stats, location stats, and unit status breakdowns.
    """

    permission_classes = [IsAuthenticated]

    def list(self, request):
        """Return high-level dashboard summary."""
        from .analytics import get_dashboard_summary
        return Response(get_dashboard_summary())

    @action(detail=False, methods=["get"])
    def price_trends(self, request):
        """Get price trends over time."""
        from .analytics import get_price_trends
        period = request.query_params.get("period", "6m")
        city = request.query_params.get("city", None)
        return Response(get_price_trends(period, city))

    @action(detail=False, methods=["get"])
    def request_volume(self, request):
        """Get inquiry and lead volume over time."""
        from .analytics import get_request_volume
        period = request.query_params.get("period", "6m")
        return Response(get_request_volume(period))

    @action(detail=False, methods=["get"])
    def conversion_funnel(self, request):
        """Get conversion funnel data."""
        from .analytics import get_conversion_funnel
        return Response(get_conversion_funnel())

    @action(detail=False, methods=["get"])
    def category_stats(self, request):
        """Get statistics by property type."""
        from .analytics import get_category_stats
        return Response(get_category_stats())

    @action(detail=False, methods=["get"])
    def location_stats(self, request):
        """Get statistics by city/province."""
        from .analytics import get_location_stats
        return Response(get_location_stats())

    @action(detail=False, methods=["get"])
    def unit_status(self, request):
        """Get unit status breakdown."""
        from .analytics import get_unit_status_stats
        project_id = request.query_params.get("project", None)
        project = None
        if project_id:
            try:
                project = Project.objects.get(id=project_id)
            except Project.DoesNotExist:
                pass
        return Response(get_unit_status_stats(project))


class ScanInboxViewSet(viewsets.ReadOnlyModelViewSet):
    """Review queue for scanned messages not classified as property requests."""

    serializer_class = ScanInboxItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if not _is_staff(self.request):
            return ScanInboxItem.objects.none()
        queryset = ScanInboxItem.objects.select_related("lead", "broker", "property")
        status_filter = self.request.query_params.get("status", "pending")
        if status_filter != "all":
            queryset = queryset.filter(status=status_filter)
        query = self.request.query_params.get("q", "").strip()
        if query:
            queryset = queryset.filter(
                Q(sender__icontains=query)
                | Q(message__icontains=query)
                | Q(whatsapp_group__icontains=query)
            )
        return queryset

    @action(detail=True, methods=["post"])
    def save_as_request(self, request, pk=None):
        item = self.get_object()
        if item.lead_id:
            return Response(
                {"detail": "This scanned message is already linked to a request.", "lead_id": item.lead_id},
                status=status.HTTP_409_CONFLICT,
            )
        from .whatsapp_parser import extract_lead_data
        from .whatsapp_parser.extractor import extract_phone_number

        extracted = extract_lead_data({"sender": item.sender, "message": item.message})
        sender_phone = extract_phone_number(item.sender)
        lead = Lead.objects.create(
            name=(request.data.get("name") or extracted.get("full_name") or item.sender or "Unknown requester")[:200],
            phone=(request.data.get("phone") if request.data.get("phone") is not None else sender_phone),
            source_sender=item.sender[:200],
            whatsapp_group=item.whatsapp_group,
            source="whatsapp",
            listing_type=request.data.get("listing_type") or extracted.get("listing_type", "any"),
            property_type=request.data.get("property_type") or extracted.get("property_type") or None,
            min_bedrooms=request.data.get("min_bedrooms", extracted.get("min_bedrooms")),
            max_bedrooms=request.data.get("max_bedrooms", extracted.get("max_bedrooms")),
            min_bathrooms=request.data.get("min_bathrooms", extracted.get("min_bathrooms")),
            max_bathrooms=request.data.get("max_bathrooms", extracted.get("max_bathrooms")),
            min_price=request.data.get("min_price", extracted.get("min_price")),
            max_price=request.data.get("max_price", extracted.get("max_price")),
            budget_currency=request.data.get("budget_currency") or extracted.get("budget_currency") or None,
            preferred_location=request.data.get("preferred_location") or extracted.get("preferred_location") or None,
            furnishing=request.data.get("furnishing") or extracted.get("furnishing") or None,
            city=request.data.get("city") or None,
            province=request.data.get("province") or None,
            notes=f"WhatsApp request:\n{item.message}",
            attachments=item.attachments,
            status="new",
        )
        item.lead = lead
        item.status = "request"
        item.save(update_fields=["lead", "status", "updated_at"])
        create_matches_for_lead(lead)
        return Response(LeadSerializer(lead).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def save_as_broker(self, request, pk=None):
        item = self.get_object()
        if item.broker_id:
            return Response(
                {"detail": "This scanned message is already linked to a broker.", "broker_id": item.broker_id},
                status=status.HTTP_409_CONFLICT,
            )
        from .whatsapp_parser.extractor import extract_phone_number

        broker_name = (request.data.get("name") or item.sender).strip()
        if not broker_name:
            return Response(
                {"detail": "A broker name is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        phone = (request.data.get("phone") or extract_phone_number(item.sender))[:50]
        broker_query = Broker.objects.filter(name__iexact=broker_name)
        if phone:
            broker_query = Broker.objects.filter(Q(phone=phone) | Q(name__iexact=broker_name))
        broker = broker_query.order_by("id").first()
        created = broker is None
        if created:
            broker = Broker.objects.create(
                name=broker_name[:200],
                phone=phone,
                company=(request.data.get("company") or "")[:200],
                notes=request.data.get("notes") or "",
            )
        item.broker = broker
        item.status = "broker"
        item.save(update_fields=["broker", "status", "updated_at"])
        return Response(
            BrokerSerializer(broker).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"])
    def save_as_estate(self, request, pk=None):
        item = self.get_object()
        if item.property_id:
            return Response(
                {"detail": "This scanned message is already linked to an estate.", "property_id": item.property_id},
                status=status.HTTP_409_CONFLICT,
            )
        serializer = PropertySerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        estate = serializer.save(
            source_lead=item.lead,
            broker_id=request.data.get("broker") or None,
        )
        item.property = estate
        item.status = "estate"
        item.save(update_fields=["property", "status", "updated_at"])
        create_matches_for_property(estate)
        return Response(
            PropertySerializer(estate, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def dismiss(self, request, pk=None):
        item = self.get_object()
        item.status = "dismissed"
        item.save(update_fields=["status", "updated_at"])
        return Response({"detail": "Scanned message dismissed."})


class WhatsAppImportViewSet(viewsets.ViewSet):
    """
    API for importing WhatsApp chat export ZIP files.
    Staff can upload a ZIP export and the system will parse it,
    extract leads, and auto-match them against properties.
    """

    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=["post"])
    def import_chat(self, request):
        """Import a WhatsApp chat export ZIP file."""
        zip_file = request.FILES.get("zip_file")
        if not zip_file:
            return Response(
                {"detail": "No ZIP file provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            recent_days = int(request.data.get("recent_days", 30))
        except (TypeError, ValueError):
            return Response(
                {"detail": "recent_days must be a positive number."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not 1 <= recent_days <= 3650:
            return Response(
                {"detail": "recent_days must be between 1 and 3650."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if zip_file.size > 50 * 1024 * 1024:
            return Response(
                {"detail": "ZIP file exceeds the 50 MB upload limit."},
                status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )

        import mimetypes
        import os
        import tempfile
        import uuid
        import zipfile
        from pathlib import Path
        from django.core.files import File
        from django.core.files.storage import FileSystemStorage
        from django.utils.text import get_valid_filename

        tmp_path = None
        extract_dir = None

        try:
            with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as tmp:
                tmp_path = tmp.name
                for chunk in zip_file.chunks():
                    tmp.write(chunk)

            from estates.whatsapp_parser import (
                unzip_chat_export,
                parse_whatsapp_chat,
                associate_request_context,
                associate_followup_attachments,
                dedupe_messages,
                DEFAULT_LEAD_KEYWORDS,
                classify_lead_intent,
                filter_property_leads,
                extract_lead_data,
            )
            from estates.models import ScanInboxItem
            from hashlib import sha256
            from estates.matching import create_matches_for_lead

            txt_path, extract_dir = unzip_chat_export(
                tmp_path, str(settings.MEDIA_ROOT)
            )
            chat_file_name = os.path.basename(txt_path)
            day_first_dates = chat_file_name.lower().startswith("chat de whatsapp con ")
            all_messages = associate_request_context(
                parse_whatsapp_chat(txt_path, extract_dir)
            )
            upper_keywords = {
                k: [kw.upper() for kw in v]
                for k, v in DEFAULT_LEAD_KEYWORDS.items()
            }
            for msg in all_messages:
                msg['destination'] = classify_lead_intent(
                    msg['message'], upper_keywords
                )
            all_messages = associate_followup_attachments(all_messages)
            lead_msgs, misc_msgs = filter_property_leads(
                all_messages,
                upper_keywords,
                recent_days,
                day_first=day_first_dates,
            )
            unique_leads = dedupe_messages(lead_msgs)
            imported = 0
            skipped = 0
            ignored = 0
            matches_created = 0
            media_imported = 0
            errors = []
            media_storage = FileSystemStorage(location=settings.MEDIA_ROOT)
            media_files = {}
            import_id = uuid.uuid4().hex
            chat_name = os.path.splitext(chat_file_name)[0]
            for prefix in ("Chat de WhatsApp con ", "WhatsApp Chat with "):
                if chat_name.startswith(prefix):
                    chat_name = chat_name[len(prefix):]
                    break
            from estates.whatsapp_parser import normalize_whatsapp_sender

            ignored_sender_keys = set(
                WhatsAppIgnoredUser.objects.values_list("sender_key", flat=True)
            )

            # Index existing contacts by normalized phone digits for linking.
            def _phone_digits(value):
                return re.sub(r"\D", "", value or "")

            broker_by_phone = {
                _phone_digits(b.phone): b
                for b in Broker.objects.exclude(phone="").exclude(phone__isnull=True)
            }
            owner_by_phone = {
                _phone_digits(o.phone): o
                for o in Owner.objects.exclude(phone="").exclude(phone__isnull=True)
            }

            brokers_linked = 0
            archive_media = {}
            for path in Path(extract_dir).rglob("*"):
                if path.is_file() and path.suffix.lower() not in (".txt", ".json"):
                    archive_media.setdefault(path.name.casefold(), path)

            def save_message_attachments(msg):
                nonlocal media_imported
                attachments = []
                for attachment_name in msg.get("attachments", []):
                    source_path = archive_media.get(
                        os.path.basename(attachment_name.replace("\\", "/")).casefold()
                    )
                    if source_path is None:
                        continue

                    extension = source_path.suffix.lower()
                    content_type = mimetypes.guess_type(source_path.name)[0]
                    if extension == ".opus":
                        content_type = "audio/ogg"
                    elif extension == ".3gp":
                        content_type = "video/3gpp"
                    if (
                        not content_type
                        or content_type.split("/", 1)[0] not in {"image", "audio", "video"}
                        or content_type == "image/svg+xml"
                    ):
                        continue

                    media_key = str(source_path.resolve())
                    if media_key not in media_files:
                        safe_name = get_valid_filename(source_path.name)
                        with source_path.open("rb") as media_file:
                            media_path = media_storage.save(
                                f"whatsapp_imports/{import_id}/{safe_name}",
                                File(media_file),
                            )
                        media_files[media_key] = {
                            "name": source_path.name,
                            "url": request.build_absolute_uri(media_storage.url(media_path)),
                            "content_type": content_type,
                        }
                        media_imported += 1
                    media_record = media_files[media_key]
                    attachments.append({
                        "name": media_record["name"],
                        "url": media_record["url"],
                        "content_type": media_record["content_type"],
                    })
                return attachments

            inbox_saved = 0
            inbox_existing = 0
            for msg in dedupe_messages(misc_msgs):
                source_sender = msg.get("sender", "").strip()
                sender_key = normalize_whatsapp_sender(source_sender)
                if sender_key and sender_key in ignored_sender_keys:
                    ignored += 1
                    continue
                fingerprint_data = "\0".join(
                    (
                        chat_name.casefold(),
                        source_sender.casefold(),
                        msg.get("date", ""),
                        msg.get("time", ""),
                        msg.get("message", ""),
                        "|".join(msg.get("attachments", [])),
                    )
                )
                fingerprint = sha256(fingerprint_data.encode("utf-8")).hexdigest()
                try:
                    inbox_item, created = ScanInboxItem.objects.get_or_create(
                        fingerprint=fingerprint,
                        defaults={
                            "whatsapp_group": chat_name[:200],
                            "sender": source_sender[:200],
                            "message_date": msg.get("date", "")[:20],
                            "message_time": msg.get("time", "")[:30],
                            "message": msg.get("message", ""),
                            "attachments": [],
                        },
                    )
                    if created or not inbox_item.attachments:
                        inbox_attachments = save_message_attachments(msg)
                        if inbox_attachments:
                            inbox_item.attachments = inbox_attachments
                            inbox_item.save(update_fields=["attachments", "updated_at"])
                except Exception as error:
                    errors.append(
                        f"Failed to save scanned message from {source_sender or 'unknown sender'}: {error}"
                    )
                    continue
                if created:
                    inbox_saved += 1
                else:
                    inbox_existing += 1

            for msg in unique_leads:
                source_sender = msg.get("sender", "").strip()
                sender_key = normalize_whatsapp_sender(source_sender)
                if sender_key and sender_key in ignored_sender_keys:
                    ignored += 1
                    continue

                lead_data = extract_lead_data(msg)
                phone = lead_data.get('phone', '')
                name = lead_data.get('full_name', '')

                request_notes = (
                    f"WhatsApp request:\n{lead_data.get('source_message', '')}"
                )
                duplicate_query = Lead.objects.filter(
                    whatsapp_group=chat_name[:200],
                    notes=request_notes,
                )
                if source_sender:
                    duplicate_query = duplicate_query.filter(
                        Q(source_sender=source_sender)
                        | Q(source_sender="", name=name[:200])
                    )
                elif phone:
                    duplicate_query = duplicate_query.filter(phone=phone)
                else:
                    duplicate_query = duplicate_query.filter(name=name[:200], phone="")
                if duplicate_query.exists():
                    skipped += 1
                    continue

                attachments = []
                try:
                    attachments = save_message_attachments(msg)

                    lead_phone_digits = _phone_digits(lead_data.get('phone', ''))
                    matched_broker = broker_by_phone.get(lead_phone_digits)
                    matched_owner = owner_by_phone.get(lead_phone_digits)

                    lead = Lead.objects.create(
                        name=lead_data['full_name'][:200],
                        phone=lead_data['phone'],
                        source_sender=source_sender[:200],
                        broker=matched_broker,
                        whatsapp_group=chat_name[:200],
                        source="whatsapp",
                        listing_type=lead_data.get('listing_type', 'any'),
                        property_type=lead_data.get('property_type', '') or None,
                        min_bedrooms=lead_data.get('min_bedrooms'),
                        max_bedrooms=lead_data.get('max_bedrooms'),
                        min_bathrooms=lead_data.get('min_bathrooms'),
                        max_bathrooms=lead_data.get('max_bathrooms'),
                        min_price=lead_data.get('min_price'),
                        max_price=lead_data.get('max_price'),
                        budget_currency=lead_data.get('budget_currency') or None,
                        preferred_location=lead_data.get('preferred_location') or None,
                        furnishing=lead_data.get('furnishing') or None,
                        city=lead_data.get('city', '') or None,
                        province=lead_data.get('province', '') or None,
                        notes=request_notes,
                        attachments=attachments,
                        status="new",
                    )

                    if matched_broker:
                        brokers_linked += 1

                    imported += 1
                except Exception as e:
                    errors.append(f"Failed to create lead for {name}: {str(e)}")
                    continue

                try:
                    new_matches = create_matches_for_lead(lead)
                    matches_created += len(new_matches)
                except Exception as e:
                    errors.append(f"Failed to match lead {lead.name}: {str(e)}")

            return Response(
                {
                    "detail": "Import complete.",
                    "imported": imported,
                    "skipped": skipped,
                    "ignored": ignored,
                    "inbox_saved": inbox_saved,
                    "inbox_existing": inbox_existing,
                    "matches_created": matches_created,
                    "media_imported": media_imported,
                    "brokers_linked": brokers_linked,
                    "total_messages": len(all_messages),
                    "errors": errors,
                },
                status=status.HTTP_201_CREATED if not errors else status.HTTP_207_MULTI_STATUS,
            )
        except (ValueError, zipfile.BadZipFile) as e:
            return Response(
                {
                    "detail": (
                        "The uploaded file is not a valid ZIP file."
                        if isinstance(e, zipfile.BadZipFile)
                        else str(e)
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return Response(
                {"detail": f"Import failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        finally:
            if extract_dir and os.path.exists(extract_dir):
                import shutil
                shutil.rmtree(extract_dir, ignore_errors=True)
            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)
