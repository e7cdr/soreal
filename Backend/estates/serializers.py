from rest_framework import serializers

from .models import (
    AdCampaign,
    AudioTrack,
    Broker,
    Owner,
    Property,
    PropertyImage,
    PropertyInquiry,
    Reel,
    ReelSlide,
    ReelTemplate,
    SavedSearch,
    TenantApplication,
    Lead,
    LeadLeadMatch,
    LeadMatch,
    MarketingPost,
    Project,
    ProjectUnit,
    ProjectBulkUpload,
    ScanInboxItem,
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
    broker_name = serializers.CharField(source="broker.name", read_only=True, allow_null=True)
    source_lead_details = serializers.SerializerMethodField()

    class Meta:
        model = Property
        fields = [
            "id",
            "custom_id",
            "title",
            "slug",
            "description",
            "meta_title",
            "meta_description",
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
            "broker",
            "broker_name",
            "owner",
            "source_lead",
            "source_lead_details",
            "source_site",
            "source_url",
            "source_imported_at",
            "source_verified",
            "source_status",
            "persona_name",
            "persona_demographics",
            "persona_motivations",
            "persona_objections",
            "persona_marketing_angle",
            "images",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["slug", "source_lead", "created_at", "updated_at"]

    def get_source_lead_details(self, obj):
        lead = obj.source_lead
        if lead is None:
            return None
        return {
            "id": lead.id,
            "name": lead.name,
            "phone": lead.phone,
            "whatsapp_group": lead.whatsapp_group,
            "broker_name": lead.broker.name if lead.broker_id else None,
        }


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

    broker_name = serializers.CharField(source="broker.name", read_only=True, allow_null=True)
    broker_company = serializers.CharField(source="broker.company", read_only=True, allow_null=True)
    estate_id = serializers.SerializerMethodField()
    estate_slug = serializers.SerializerMethodField()

    class Meta:
        model = Lead
        fields = [
            "id",
            "name",
            "phone",
            "source_sender",
            "broker",
            "broker_name",
            "broker_company",
            "estate_id",
            "estate_slug",
            "whatsapp_group",
            "source",
            "listing_type",
            "property_type",
            "min_bedrooms",
            "max_bedrooms",
            "min_bathrooms",
            "max_bathrooms",
            "min_price",
            "max_price",
            "budget_currency",
            "preferred_location",
            "furnishing",
            "city",
            "province",
            "notes",
            "attachments",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["source_sender", "attachments", "created_at", "updated_at"]

    def get_estate_id(self, obj):
        return obj.created_property.id if hasattr(obj, "created_property") else None

    def get_estate_slug(self, obj):
        return obj.created_property.slug if hasattr(obj, "created_property") else None


class BrokerSerializer(serializers.ModelSerializer):
    request_count = serializers.IntegerField(read_only=True)
    property_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Broker
        fields = [
            "id",
            "name",
            "phone",
            "email",
            "company",
            "notes",
            "request_count",
            "property_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["request_count", "property_count", "created_at", "updated_at"]


class OwnerSerializer(serializers.ModelSerializer):
    property_count = serializers.IntegerField(read_only=True)
    project_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Owner
        fields = [
            "id",
            "name",
            "phone",
            "email",
            "company",
            "identification",
            "notes",
            "property_count",
            "project_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["property_count", "project_count", "created_at", "updated_at"]


class ScanInboxItemSerializer(serializers.ModelSerializer):
    lead_id = serializers.IntegerField(read_only=True)
    broker_id = serializers.IntegerField(read_only=True)
    property_id = serializers.IntegerField(read_only=True)
    property_slug = serializers.CharField(source="property.slug", read_only=True, allow_null=True)
    suggested_request = serializers.SerializerMethodField()

    class Meta:
        model = ScanInboxItem
        fields = [
            "id",
            "fingerprint",
            "whatsapp_group",
            "sender",
            "message_date",
            "message_time",
            "message",
            "attachments",
            "status",
            "lead_id",
            "broker_id",
            "property_id",
            "property_slug",
            "suggested_request",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_suggested_request(self, obj):
        from .whatsapp_parser import extract_lead_data
        from .whatsapp_parser.extractor import extract_phone_number

        extracted = extract_lead_data({"sender": obj.sender, "message": obj.message})
        return {
            "name": extracted.get("full_name") or obj.sender,
            "phone": extract_phone_number(obj.sender),
            "listing_type": extracted.get("listing_type") or "any",
            "property_type": extracted.get("property_type") or "",
            "min_bedrooms": extracted.get("min_bedrooms"),
            "max_bedrooms": extracted.get("max_bedrooms"),
            "min_bathrooms": extracted.get("min_bathrooms"),
            "max_bathrooms": extracted.get("max_bathrooms"),
            "min_price": extracted.get("min_price"),
            "max_price": extracted.get("max_price"),
            "budget_currency": extracted.get("budget_currency") or "",
            "preferred_location": extracted.get("preferred_location") or "",
            "furnishing": extracted.get("furnishing") or "",
        }


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


class LeadLeadMatchSerializer(serializers.ModelSerializer):
    """Serializer for lead-lead matches."""

    lead_a_name = serializers.SerializerMethodField()
    lead_a_phone = serializers.SerializerMethodField()
    lead_b_name = serializers.SerializerMethodField()
    lead_b_phone = serializers.SerializerMethodField()

    class Meta:
        model = LeadLeadMatch
        fields = [
            "id",
            "lead_a",
            "lead_a_name",
            "lead_a_phone",
            "lead_b",
            "lead_b_name",
            "lead_b_phone",
            "match_score",
            "match_reasons",
            "status",
            "notified_at",
            "created_at",
        ]
        read_only_fields = ["lead_a", "lead_b", "match_score", "match_reasons", "created_at"]

    def get_lead_a_name(self, obj):
        return obj.lead_a.name

    def get_lead_a_phone(self, obj):
        return obj.lead_a.phone

    def get_lead_b_name(self, obj):
        return obj.lead_b.name

    def get_lead_b_phone(self, obj):
        return obj.lead_b.phone


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

    unit_count = serializers.IntegerField(read_only=True, default=0)
    available_count = serializers.IntegerField(read_only=True, default=0)
    sold_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Project
        fields = [
            "id",
            "custom_id",
            "name",
            "slug",
            "description",
            "developer",
            "broker",
            "owner",
            "address",
            "city",
            "province",
            "status",
            "total_units",
            "available_units",
            "unit_count",
            "available_count",
            "sold_count",
            "created_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["slug", "created_at", "updated_at"]


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


class MarketingPostSerializer(serializers.ModelSerializer):
    """Serializer for marketing/social media posts."""

    estate_title = serializers.CharField(source="estate.title", read_only=True, allow_null=True)
    estate_slug = serializers.CharField(source="estate.slug", read_only=True, allow_null=True)

    class Meta:
        model = MarketingPost
        fields = [
            "id",
            "title",
            "caption",
            "platform",
            "status",
            "scheduled_for",
            "posted_at",
            "estate",
            "estate_title",
            "estate_slug",
            "media_url",
            "created_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["posted_at", "created_at", "updated_at"]


class AdCampaignSerializer(serializers.ModelSerializer):
    """Serializer for ad campaigns."""

    estate_title = serializers.CharField(source="estate.title", read_only=True, allow_null=True)
    estate_slug = serializers.CharField(source="estate.slug", read_only=True, allow_null=True)

    class Meta:
        model = AdCampaign
        fields = [
            "id",
            "name",
            "objective",
            "daily_budget",
            "currency",
            "target_location",
            "target_age_min",
            "target_age_max",
            "target_interests",
            "estate",
            "estate_title",
            "estate_slug",
            "ad_copy",
            "image_url",
            "utm_source",
            "utm_medium",
            "utm_campaign",
            "status",
            "created_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class AudioTrackSerializer(serializers.ModelSerializer):
    """Serializer for audio tracks used in reels."""

    class Meta:
        model = AudioTrack
        fields = [
            "id",
            "title",
            "file",
            "duration_seconds",
            "bpm",
            "key",
            "waveform_peaks",
            "spectral_bands",
            "sections",
            "genre_tag",
            "created_by",
            "created_at",
        ]
        read_only_fields = [
            "duration_seconds",
            "bpm",
            "key",
            "waveform_peaks",
            "spectral_bands",
            "sections",
            "created_at",
        ]


class ReelSlideSerializer(serializers.ModelSerializer):
    """Serializer for reel slides."""

    class Meta:
        model = ReelSlide
        fields = [
            "id",
            "image",
            "image_url",
            "duration_seconds",
            "transition_type",
            "transition_duration",
            "text_overlay",
            "text_position",
            "text_font_scale",
            "text_font_family",
            "text_color",
            "text_custom_color",
            "text_background",
            "text_background_opacity",
            "text_animation",
            "text_animation_duration",
            "text_shadow",
            "lower_third",
            "beat_offset",
            "order",
        ]


class ReelSerializer(serializers.ModelSerializer):
    """Serializer for reels."""

    estate_title = serializers.CharField(source="estate.title", read_only=True, allow_null=True)
    estate_slug = serializers.CharField(source="estate.slug", read_only=True, allow_null=True)
    audio_track_title = serializers.CharField(
        source="audio_track.title", read_only=True, allow_null=True
    )
    slides = ReelSlideSerializer(many=True, read_only=True)

    class Meta:
        model = Reel
        fields = [
            "id",
            "title",
            "description",
            "estate",
            "estate_title",
            "estate_slug",
            "audio_track",
            "audio_track_title",
            "bpm",
            "aspect_ratio",
            "duration_seconds",
            "video_url",
            "thumbnail_url",
            "status",
            "slides",
            "created_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "duration_seconds",
            "video_url",
            "thumbnail_url",
            "status",
            "created_at",
            "updated_at",
        ]


class ReelTemplateSerializer(serializers.ModelSerializer):
    """Serializer for reel templates."""

    class Meta:
        model = ReelTemplate
        fields = [
            "id",
            "name",
            "description",
            "genre_tag",
            "bpm_min",
            "bpm_max",
            "slide_count",
            "transition_style",
            "text_style",
            "is_builtin",
            "created_at",
        ]
        read_only_fields = ["created_at"]

