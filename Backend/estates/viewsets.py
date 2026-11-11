from django.db.models import Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import (
    Property,
    PropertyInquiry,
    TenantApplication,
    SavedSearch,
    Lead,
    LeadMatch,
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


class PropertyViewSet(viewsets.ModelViewSet):
    """
    API for property listings.

    Public users only see available/reserved properties.
    Staff users see all properties.

    When a new property is created, it is automatically matched
    against existing leads.
    """

    queryset = Property.objects.all()
    serializer_class = PropertySerializer
    permission_classes = [AllowAny]
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

    queryset = PropertyInquiry.objects.all()
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

    queryset = TenantApplication.objects.all()
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
        return super().get_queryset()

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


class LeadMatchViewSet(viewsets.ModelViewSet):
    """
    API for lead-property matches.

    Staff can LIST, VIEW, and UPDATE match status
    (pending, notified, contacted, dismissed).
    """

    queryset = LeadMatch.objects.all()
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

    queryset = Project.objects.all()
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated]
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

    def get_queryset(self):
        queryset = super().get_queryset()
        project = self.request.query_params.get("project", None)
        status = self.request.query_params.get("status", None)
        if project:
            queryset = queryset.filter(project=project)
        if status:
            queryset = queryset.filter(status=status)
        return queryset

    @action(detail=False, methods=["post"], permission_classes=[IsAuthenticated])
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
            project = Project.objects.get(id=project_id)
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

        recent_days = int(request.data.get("recent_days", 30))
        debug = request.data.get("debug", "false").lower() == "true"

        import os
        import tempfile

        # Save uploaded ZIP to a temp file
        with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as tmp:
            for chunk in zip_file.chunks():
                tmp.write(chunk)
            tmp_path = tmp.name

        try:
            from estates.whatsapp_parser import (
                unzip_chat_export,
                parse_whatsapp_chat,
                associate_followup_attachments,
                dedupe_messages,
                classify_lead_intent,
                filter_property_leads,
                extract_lead_data,
            )
            from estates.matching import create_matches_for_lead

            DEFAULT_LEAD_KEYWORDS = {
                'for_rent': [
                    'RENT', 'RENTAL', 'FOR RENT', 'ALQUILER', 'APARTAMENTO RENTA', 'CASA RENTA',
                    'LOOKING TO RENT', 'NEED TO RENT', 'WANT TO RENT', 'SE BUSCA RENTA',
                    'APARTMENT FOR RENT', 'HOUSE FOR RENT', 'ROOM FOR RENT',
                ],
                'for_sale': [
                    'FOR SALE', 'EN VENTA', 'BUY', 'PURCHASE', 'LOOKING TO BUY', 'WANT TO BUY',
                    'SE BUSCA CASA', 'APARTMENT FOR SALE', 'HOUSE FOR SALE', 'PROPERTY FOR SALE',
                    'LAND FOR SALE', 'VILLA FOR SALE',
                ],
                'property_inquiry': [
                    'BEDROOMS', 'BATHROOMS', 'PRICE', 'PRICE RANGE', 'LOCATION', 'AREA', 'SQM',
                    'M2', 'SQUARE METERS', 'NEIGHBORHOOD', 'BARRIO', 'SECTOR', 'CONDOS',
                    'CONDOMINIUM', 'APARTMENT', 'HOUSE', 'VILLA', 'LAND', 'TERRENO',
                    'HOW MUCH', 'CUANTO', 'CUÁNTO', 'DISPONIBLE', 'AVAILABLE',
                ],
                'real_estate': [
                    'REAL ESTATE', 'INMOBILIARIA', 'AGENT', 'AGENTE', 'BROKER', 'PROPERTY',
                    'PROPIEDAD', 'LISTING', 'EXCLUSIVE', 'EXCLUSIVA',
                ],
            }

            # Step 1: Extract ZIP
            txt_path, extract_dir = unzip_chat_export(
                tmp_path, settings.MEDIA_ROOT, debug=debug
            )

            # Step 2: Parse messages
            all_messages = parse_whatsapp_chat(txt_path, extract_dir, debug=debug)

            # Step 3: Classify all messages
            upper_keywords = {
                k: [kw.upper() for kw in v]
                for k, v in DEFAULT_LEAD_KEYWORDS.items()
            }
            for msg in all_messages:
                msg['destination'] = classify_lead_intent(
                    msg['message'], upper_keywords
                )

            # Step 4: Associate follow-up attachments
            all_messages = associate_followup_attachments(
                all_messages, debug=debug
            )

            # Step 5: Filter property leads
            lead_msgs, misc_msgs = filter_property_leads(
                all_messages, upper_keywords, recent_days, debug=debug
            )

            # Step 6: Deduplicate
            unique_leads = dedupe_messages(lead_msgs)

            # Step 7: Extract lead data and create records
            imported = 0
            skipped = 0
            matches_created = 0
            errors = []

            for msg in unique_leads:
                lead_data = extract_lead_data(msg)

                phone = lead_data.get('phone', '')
                name = lead_data.get('full_name', '')

                if Lead.objects.filter(phone=phone).exists():
                    skipped += 1
                    continue

                try:
                    lead = Lead.objects.create(
                        full_name=lead_data['full_name'],
                        phone=lead_data['phone'],
                        whatsapp_group='',
                        source='whatsapp',
                        listing_type='any',
                        property_type=lead_data.get('property_type', '') or None,
                        min_bedrooms=lead_data.get('min_bedrooms'),
                        max_bedrooms=lead_data.get('max_bedrooms'),
                        min_price=lead_data.get('min_price'),
                        max_price=lead_data.get('max_price'),
                        city=lead_data.get('city', '') or None,
                        province=lead_data.get('province', '') or None,
                        notes=f"WhatsApp message: {lead_data.get('source_message', '')}",
                        status='new',
                    )

                    new_matches = create_matches_for_lead(lead)
                    matches_created += len(new_matches)

                    imported += 1

                except Exception as e:
                    errors.append(f"Failed to create lead for {name}: {str(e)}")

            return Response(
                {
                    "detail": "Import complete.",
                    "imported": imported,
                    "skipped": skipped,
                    "matches_created": matches_created,
                    "total_messages": len(all_messages),
                    "errors": errors,
                },
                status=status.HTTP_201_CREATED if not errors else status.HTTP_207_MULTI_STATUS,
            )

        except Exception as e:
            return Response(
                {"detail": f"Import failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        finally:
            # Clean up temp file
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)


