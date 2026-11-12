import csv
from django.conf import settings
from django.core.mail import send_mail
from django.db.models import Count, Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated

from .models import BlacklistedPerson, ReportSubmission
from .permissions import BlacklistSectionAccess, IsStaffOrReadOnly
from .serializers import (
    BlacklistedPersonPublicSerializer,
    BlacklistedPersonSerializer,
    ReportSubmissionCreateSerializer,
    ReportSubmissionSerializer,
)


def _is_staff(request):
    return (
        request.user
        and request.user.is_authenticated
        and request.user.is_staff
    )


class BlacklistedPersonViewSet(viewsets.ModelViewSet):
    """
    API for blacklisted person records.

    Public (unauthenticated) users see only `public` records using the public
    serializer (masked ID, no internal notes/contacts).
    Staff users see all records with full detail.
    """

    queryset = BlacklistedPerson.objects.prefetch_related("images__image")
    permission_classes = [IsStaffOrReadOnly, BlacklistSectionAccess]
    lookup_field = "case_id"

    filterset_fields = ["status", "category", "risk_level", "visibility"]
    search_fields = ["full_name", "identification", "case_id", "aliases"]
    ordering_fields = ["created_at", "full_name", "case_id", "incident_date"]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        if _is_staff(self.request):
            return BlacklistedPersonSerializer
        return BlacklistedPersonPublicSerializer

    def get_queryset(self):
        queryset = super().get_queryset()

        if not _is_staff(self.request):
            # Public: only public records
            queryset = queryset.filter(visibility="public")
        else:
            queryset = queryset.prefetch_related("reporters")

        # Query params
        q = self.request.query_params.get("q", None)
        date_from = self.request.query_params.get("date_from", None)
        date_to = self.request.query_params.get("date_to", None)

        if q:
            queryset = queryset.filter(
                Q(full_name__icontains=q)
                | Q(identification__icontains=q)
                | Q(case_id__icontains=q)
                | Q(aliases__icontains=q)
            )

        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)

        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)

        return queryset

    def perform_create(self, serializer):
        """Staff creation: detect duplicates by ID number before saving."""
        if not _is_staff(self.request):
            return
        identification = serializer.validated_data.get("identification")
        if identification and BlacklistedPerson.objects.filter(
            identification=identification
        ).exists():
            from rest_framework.exceptions import ValidationError

            raise ValidationError(
                {"identification": "A record with this ID number already exists."}
        )
        serializer.save(
            created_by=self.request.user.username,
            _changed_by=self.request.user.username,
        )

    @action(detail=False, methods=["get"], permission_classes=[AllowAny])
    def stats(self, request):
        """Public stats for the blacklist dashboard."""
        queryset = BlacklistedPerson.objects.all()
        if not _is_staff(request):
            queryset = queryset.filter(visibility="public")

        now = timezone.now()
        status_choices = BlacklistedPerson.STATUS_CHOICES
        stats = queryset.aggregate(
            total=Count("pk"),
            this_month=Count(
                "pk",
                filter=Q(created_at__year=now.year, created_at__month=now.month),
            ),
            **{
                f"status_{status_key}": Count("pk", filter=Q(status=status_key))
                for status_key, _ in status_choices
            },
        )
        by_status = {
            status_key: stats[f"status_{status_key}"]
            for status_key, _ in status_choices
        }

        return Response(
            {
                "total": stats["total"],
                "this_month": stats["this_month"],
                "by_status": by_status,
            }
        )

    @action(detail=False, methods=["post"], permission_classes=[AllowAny])
    def access(self, request):
        """Unlock the blacklist section with the section-wide password."""
        password = getattr(settings, "BLACKLIST_ACCESS_PASSWORD", "")
        if not password:
            return Response(
                {"detail": "No access password configured."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        supplied = request.data.get("password", "")
        if supplied == password:
            request.session["blacklist_access_token"] = password
            request.session.set_expiry(3600)  # 1 hour
            return Response({"detail": "Access granted."})
        return Response(
            {"detail": "Invalid password."},
            status=status.HTTP_403_FORBIDDEN,
        )

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def export_csv(self, request):
        """Export blacklist records as CSV (staff only)."""
        if not _is_staff(request):
            return Response(
                {"detail": "Staff access required."},
                status=status.HTTP_403_FORBIDDEN,
            )

        queryset = self.filter_queryset(self.get_queryset())

        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="blacklist_export.csv"'

        writer = csv.writer(response)
        writer.writerow(
            [
                "Case ID",
                "Full Name",
                "Aliases",
                "ID Type",
                "Identification",
                "Nationality",
                "Phone",
                "Email",
                "Status",
                "Category",
                "Risk Level",
                "Incident Date",
                "Incident Location",
                "Description",
                "Internal Notes",
                "Source",
                "Is Verified",
                "Visibility",
                "Created By",
                "Created At",
                "Updated At",
            ]
        )

        for person in queryset:
            writer.writerow(
                [
                    person.case_id,
                    person.full_name,
                    person.aliases,
                    person.id_type,
                    person.identification,
                    person.nationality,
                    person.phone,
                    person.email,
                    person.status,
                    person.category,
                    person.risk_level,
                    person.incident_date,
                    person.incident_location,
                    person.description,
                    person.internal_notes,
                    person.source,
                    person.is_verified,
                    person.visibility,
                    person.created_by,
                    person.created_at,
                    person.updated_at,
                ]
            )

        return response


class ReportSubmissionViewSet(viewsets.ModelViewSet):
    """
    API for public report submissions.

    - Public (AllowAny): can CREATE a submission (POST).
    - Staff: can LIST, RETRIEVE, UPDATE (approve/reject) submissions.
    """

    queryset = ReportSubmission.objects.all()
    lookup_field = "submission_id"

    filterset_fields = ["status", "category"]
    search_fields = ["full_name", "identification", "submission_id", "aliases"]
    ordering_fields = ["submitted_at", "full_name", "submission_id"]
    ordering = ["-submitted_at"]

    def get_permissions(self):
        if self.action in ("create",):
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.action in ("create",):
            return ReportSubmissionCreateSerializer
        return ReportSubmissionSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        if not _is_staff(self.request):
            # Non-staff can only see their own submissions if we tracked user;
            # for now, hide all from public.
            return ReportSubmission.objects.none()
        return queryset

    def perform_create(self, serializer):
        submission = serializer.save()

        # Notify staff about new submission
        admin_emails = getattr(settings, "ADMIN_EMAILS", [])
        if admin_emails:
            send_mail(
                subject=f"[Lista Negra] New Report Submission - {submission.submission_id}",
                message=(
                    f"A new report submission has been received.\n\n"
                    f"Submission ID: {submission.submission_id}\n"
                    f"Name: {submission.full_name}\n"
                    f"ID: {submission.id_type} {submission.identification}\n"
                    f"Category: {submission.category}\n"
                    f"Location: {submission.incident_location}\n"
                    f"Date: {submission.incident_date}\n\n"
                    f"Description:\n{submission.description}\n\n"
                    f"Review at: {settings.WAGTAILADMIN_BASE_URL}/admin/blacklist/reportsubmission/"
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=admin_emails,
                fail_silently=True,
            )

        # Duplicate check: warn if same identification already exists
        identification = submission.identification
        if identification:
            existing = BlacklistedPerson.objects.filter(
                identification=identification
            ).exists()
            if existing:
                # Still save, but flag for staff review
                pass

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def approve(self, request, submission_id=None):
        """Approve a submission and create a BlacklistedPerson record."""
        submission = self.get_object()

        if submission.status != "pending":
            return Response(
                {"detail": f"Submission already {submission.status}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Duplicate check on identification
        if submission.identification:
            if BlacklistedPerson.objects.filter(
                identification=submission.identification
            ).exists():
                return Response(
                    {
                        "detail": "A blacklist record with this ID number already exists."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        person = BlacklistedPerson.objects.create(
            full_name=submission.full_name,
            aliases=submission.aliases,
            id_type=submission.id_type,
            identification=submission.identification,
            nationality=submission.nationality,
            phone=submission.phone,
            email=submission.email,
            category=submission.category,
            incident_date=submission.incident_date,
            incident_location=submission.incident_location,
            description=submission.description,
            status="reported",
            visibility="private",
            source="Public report submission",
            created_by=f"report-{submission.submission_id}",
        )

        # Copy images
        from .models import BlacklistImage, ReportSubmissionImage

        for sub_img in submission.submission_images.all():
            BlacklistImage.objects.create(
                person=person,
                image=sub_img.image,
                caption=sub_img.caption,
                is_public=False,
            )

        submission.status = "approved"
        submission.reviewed_at = timezone.now()
        submission.reviewed_by = request.user.username
        submission.approved_person = person
        submission.save()

        return Response(
            {
                "detail": "Submission approved.",
                "case_id": person.case_id,
            }
        )

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def reject(self, request, submission_id=None):
        """Reject a submission."""
        submission = self.get_object()

        if submission.status != "pending":
            return Response(
                {"detail": f"Submission already {submission.status}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        rejection_reason = request.data.get("rejection_reason", "")
        submission.status = "rejected"
        submission.rejection_reason = rejection_reason
        submission.reviewed_at = timezone.now()
        submission.reviewed_by = request.user.username
        submission.save()

        return Response({"detail": "Submission rejected."})
