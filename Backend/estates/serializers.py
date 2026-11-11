from rest_framework import serializers

from .models import (
    Property,
    PropertyImage,
    PropertyInquiry,
    TenantApplication,
    SavedSearch,
    Lead,
    LeadMatch,
    Project,
    ProjectUnit,
    ProjectBulkUpload,
)


class PropertyImageSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = PropertyImage
        fields = ["id", "image_url", "caption", "is_cover"]

    def get_image_url(self, obj):
        request = self.context.get("request")
        if obj.image and hasattr(obj.image, "url"):
            url = obj.image.url
            if request is not None:
                return request.build_absolute_uri(url)
            return url
        return None


class PropertySerializer(serializers.ModelSerializer):
    images = PropertyImageSerializer(many=True, read_only=True)

    class Meta:
        model = Property
        fields = [
            "id",
            "title",
            "slug",
            "description",
            "property_type",
            "listing_type",
            "price",
            "currency",
            "bedrooms",
            "bathrooms",
            "area_sqm",
            "address",
            "city",
            "province",
            "latitude",
            "longitude",
            "status",
            "featured",
            "amenities",
            "images",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["slug", "created_at", "updated_at"]


class PropertyInquirySerializer(serializers.ModelSerializer):
    """Serializer for property inquiries (create and read)."""

    matched_person_case_id = serializers.SerializerMethodField()

    class Meta:
        model = PropertyInquiry
        fields = [
            "id",
            "property",
            "name",
            "email",
            "phone",
            "id_type",
            "identification",
            "message",
            "status",
            "screening_status",
            "screening_notes",
            "screened_by",
            "screened_at",
            "matched_person",
            "matched_person_case_id",
            "created_at",
        ]
        read_only_fields = [
            "status",
            "screening_status",
            "screening_notes",
            "screened_by",
            "screened_at",
            "matched_person",
            "created_at",
        ]

    def get_matched_person_case_id(self, obj):
        if obj.matched_person:
            return obj.matched_person.case_id
        return None


class TenantApplicationSerializer(serializers.ModelSerializer):
    """Serializer for tenant applications."""

    inquiry_name = serializers.SerializerMethodField()
    inquiry_property_title = serializers.SerializerMethodField()

    class Meta:
        model = TenantApplication
        fields = [
            "id",
            "inquiry",
            "inquiry_name",
            "inquiry_property_title",
            "blacklisted_person",
            "screening_status",
            "screening_notes",
            "decision",
            "decision_notes",
            "decided_by",
            "decided_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "inquiry",
            "blacklisted_person",
            "screening_status",
            "decided_by",
            "decided_at",
            "created_at",
            "updated_at",
        ]

    def get_inquiry_name(self, obj):
        return obj.inquiry.name

    def get_inquiry_property_title(self, obj):
        return obj.inquiry.property.title


class SavedSearchSerializer(serializers.ModelSerializer):
    """Serializer for saved searches."""

    class Meta:
        model = SavedSearch
        fields = [
            "id",
            "name",
            "email",
            "filters",
            "is_active",
            "last_notified_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["last_notified_at", "created_at", "updated_at"]


class LeadSerializer(serializers.ModelSerializer):
    """Serializer for leads from WhatsApp groups or manual entry."""

    class Meta:
        model = Lead
        fields = [
            "id",
            "name",
            "phone",
            "whatsapp_group",
            "source",
            "listing_type",
            "property_type",
            "min_bedrooms",
            "max_bedrooms",
            "min_price",
            "max_price",
            "city",
            "province",
            "notes",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class LeadMatchSerializer(serializers.ModelSerializer):
    """Serializer for lead-property matches."""

    lead_name = serializers.SerializerMethodField()
    lead_phone = serializers.SerializerMethodField()
    property_title = serializers.SerializerMethodField()
    property_slug = serializers.SerializerMethodField()

    class Meta:
        model = LeadMatch
        fields = [
            "id",
            "lead",
            "lead_name",
            "lead_phone",
            "property",
            "property_title",
            "property_slug",
            "match_score",
            "match_reasons",
            "status",
            "notified_at",
            "created_at",
        ]
        read_only_fields = ["lead", "property", "match_score", "match_reasons", "created_at"]

    def get_lead_name(self, obj):
        return obj.lead.name

    def get_lead_phone(self, obj):
        return obj.lead.phone

    def get_property_title(self, obj):
        return obj.property.title

    def get_property_slug(self, obj):
        return obj.property.slug


class ProjectUnitSerializer(serializers.ModelSerializer):
    """Serializer for individual project units."""

    class Meta:
        model = ProjectUnit
        fields = [
            "id",
            "project",
            "unit_number",
            "unit_type",
            "bedrooms",
            "bathrooms",
            "area_sqm",
            "price",
            "currency",
            "status",
            "floor",
            "orientation",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class ProjectSerializer(serializers.ModelSerializer):
    """Serializer for real estate development projects."""

    units = ProjectUnitSerializer(many=True, read_only=True)
    unit_count = serializers.SerializerMethodField()
    available_count = serializers.SerializerMethodField()
    sold_count = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "developer",
            "address",
            "city",
            "province",
            "status",
            "total_units",
            "available_units",
            "units",
            "unit_count",
            "available_count",
            "sold_count",
            "created_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["slug", "created_at", "updated_at"]

    def get_unit_count(self, obj):
        return obj.units.count()

    def get_available_count(self, obj):
        return obj.units.filter(status="available").count()

    def get_sold_count(self, obj):
        return obj.units.filter(status__in=["sold", "rented"]).count()


class ProjectBulkUploadSerializer(serializers.ModelSerializer):
    """Serializer for bulk upload jobs."""

    class Meta:
        model = ProjectBulkUpload
        fields = [
            "id",
            "project",
            "upload_file",
            "status",
            "units_created",
            "units_updated",
            "errors",
            "created_at",
            "completed_at",
        ]
        read_only_fields = [
            "status",
            "units_created",
            "units_updated",
            "errors",
            "created_at",
            "completed_at",
        ]


# Analytics Serializers

class PriceTrendSerializer(serializers.Serializer):
    """Serializer for price trend data over time."""
    date = serializers.DateField()
    avg_price = serializers.DecimalField(max_digits=14, decimal_places=2)
    min_price = serializers.DecimalField(max_digits=14, decimal_places=2)
    max_price = serializers.DecimalField(max_digits=14, decimal_places=2)
    count = serializers.IntegerField()


class RequestVolumeSerializer(serializers.Serializer):
    """Serializer for request volume over time."""
    date = serializers.DateField()
    inquiries = serializers.IntegerField()
    leads = serializers.IntegerField()
    views = serializers.IntegerField()


class ConversionRateSerializer(serializers.Serializer):
    """Serializer for conversion funnel data."""
    stage = serializers.CharField()
    count = serializers.IntegerField()
    conversion_rate = serializers.FloatField()


class CategoryStatsSerializer(serializers.Serializer):
    """Serializer for property type/category statistics."""
    property_type = serializers.CharField()
    count = serializers.IntegerField()
    avg_price = serializers.DecimalField(max_digits=14, decimal_places=2, allow_null=True)
    total_value = serializers.DecimalField(max_digits=18, decimal_places=2)


class LocationStatsSerializer(serializers.Serializer):
    """Serializer for location-based statistics."""
    city = serializers.CharField()
    province = serializers.CharField(allow_null=True)
    count = serializers.IntegerField()
    avg_price = serializers.DecimalField(max_digits=14, decimal_places=2, allow_null=True)
