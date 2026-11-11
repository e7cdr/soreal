from rest_framework import serializers

from .models import BlacklistedPerson, BlacklistImage, BlacklistReporter, ReportSubmission, ReportSubmissionImage


class BlacklistImageSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = BlacklistImage
        fields = ["id", "image_url", "caption", "is_public"]

    def get_image_url(self, obj):
        request = self.context.get("request")
        if obj.image and hasattr(obj.image, "url"):
            url = obj.image.url
            if request is not None:
                return request.build_absolute_uri(url)
            return url
        return None


class BlacklistReporterSerializer(serializers.ModelSerializer):
    class Meta:
        model = BlacklistReporter
        fields = ["id", "name", "phone", "email", "is_public"]


class BlacklistedPersonPublicSerializer(serializers.ModelSerializer):
    """Public summary serializer. Masks sensitive ID data."""

    images = BlacklistImageSerializer(many=True, read_only=True)
    masked_id = serializers.SerializerMethodField()

    class Meta:
        model = BlacklistedPerson
        fields = [
            "case_id",
            "full_name",
            "id_type",
            "masked_id",
            "nationality",
            "status",
            "category",
            "risk_level",
            "incident_date",
            "incident_location",
            "description",
            "images",
            "is_verified",
            "created_at",
        ]

    def get_masked_id(self, obj):
        return obj.masked_identification()


class BlacklistedPersonSerializer(serializers.ModelSerializer):
    """Full staff serializer with all fields."""

    images = BlacklistImageSerializer(many=True, read_only=True)
    reporters = BlacklistReporterSerializer(many=True, read_only=True)

    class Meta:
        model = BlacklistedPerson
        fields = [
            "id",
            "case_id",
            "full_name",
            "aliases",
            "id_type",
            "identification",
            "nationality",
            "phone",
            "email",
            "photo",
            "status",
            "category",
            "risk_level",
            "incident_date",
            "incident_location",
            "description",
            "internal_notes",
            "source",
            "is_verified",
            "verified_by",
            "verified_at",
            "visibility",
            "created_by",
            "created_at",
            "updated_at",
            "images",
            "reporters",
            "legacy_case_data",
        ]
        read_only_fields = ["case_id", "created_at", "updated_at", "verified_at"]


class ReportSubmissionImageSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = ReportSubmissionImage
        fields = ["id", "image_url", "caption"]

    def get_image_url(self, obj):
        request = self.context.get("request")
        if obj.image and hasattr(obj.image, "url"):
            url = obj.image.url
            if request is not None:
                return request.build_absolute_uri(url)
            return url
        return None


class ReportSubmissionCreateSerializer(serializers.ModelSerializer):
    """Serializer for public report submissions (create only)."""

    class Meta:
        model = ReportSubmission
        fields = [
            "full_name",
            "aliases",
            "id_type",
            "identification",
            "nationality",
            "phone",
            "email",
            "category",
            "incident_date",
            "incident_location",
            "description",
        ]


class ReportSubmissionSerializer(serializers.ModelSerializer):
    """Full staff serializer for reviewing submissions."""

    images = ReportSubmissionImageSerializer(many=True, read_only=True)

    class Meta:
        model = ReportSubmission
        fields = [
            "id",
            "submission_id",
            "full_name",
            "aliases",
            "id_type",
            "identification",
            "nationality",
            "phone",
            "email",
            "category",
            "incident_date",
            "incident_location",
            "description",
            "images",
            "status",
            "rejection_reason",
            "submitted_at",
            "reviewed_at",
            "reviewed_by",
            "approved_person",
        ]
        read_only_fields = ["submission_id", "submitted_at", "reviewed_at", "approved_person"]

