from django.db import models
from django.utils.text import slugify
from modelcluster.fields import ParentalKey
from modelcluster.models import ClusterableModel
from wagtail.models import Orderable
from wagtail.admin.panels import (
    FieldPanel,
    MultiFieldPanel,
    InlinePanel,
    MultipleChooserPanel,
)
from wagtail.fields import RichTextField
from wagtail.images import get_image_model_string
from wagtail.snippets.models import register_snippet

from .utils import generate_case_id


class BlacklistImage(Orderable):
    """Images attached to a blacklist record."""

    person = ParentalKey(
        "blacklist.BlacklistedPerson",
        on_delete=models.CASCADE,
        related_name="images",
    )
    image = models.ForeignKey(
        get_image_model_string(),
        on_delete=models.CASCADE,
        related_name="+",
    )
    caption = models.CharField(max_length=250, blank=True, null=True)
    is_public = models.BooleanField(default=True)

    panels = ["image", "caption", "is_public"]

    class Meta:
        ordering = ["sort_order"]


class BlacklistReporter(Orderable):
    """People who reported this case (e.g., victims or witnesses)."""

    person = ParentalKey(
        "blacklist.BlacklistedPerson",
        on_delete=models.CASCADE,
        related_name="reporters",
    )
    name = models.CharField(max_length=100, blank=True, null=True)
    phone = models.CharField(max_length=100, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    is_public = models.BooleanField(default=False)

    panels = ["name", "phone", "email", "is_public"]

    class Meta:
        ordering = ["sort_order"]


@register_snippet
class BlacklistedPerson(ClusterableModel):
    """A blacklisted person / case record.

    Visibility rules:
      - public:  summary visible to anyone via the public API
      - private: staff only (Wagtail admin), hidden from public API
    """

    STATUS_CHOICES = [
        ("reported", "Reported"),
        ("under_review", "Under Review"),
        ("verified", "Verified"),
        ("disputed", "Disputed"),
        ("resolved", "Resolved"),
        ("archived", "Archived"),
    ]

    CATEGORY_CHOICES = [
        ("fraud", "Fraud"),
        ("unpaid_rent", "Unpaid Rent"),
        ("property_damage", "Property Damage"),
        ("scam", "Scam"),
        ("assault", "Assault"),
        ("other", "Other"),
    ]

    RISK_LEVEL_CHOICES = [
        ("low", "Low"),
        ("medium", "Medium"),
        ("high", "High"),
    ]

    VISIBILITY_CHOICES = [
        ("public", "Public"),
        ("private", "Private (staff only)"),
    ]

    case_id = models.CharField(max_length=15, unique=True, editable=False)
    full_name = models.CharField(max_length=200, blank=True, null=True)
    aliases = models.CharField(max_length=200, blank=True, null=True)

    id_type = models.CharField(
        choices=[("Passport", "Passport"), ("ID_Card", "ID Card (Cédula)")],
        max_length=20,
        blank=True,
        null=True,
        verbose_name="Type of Identification",
        help_text="Passport or ID Card (Cédula)",
    )
    identification = models.CharField(max_length=36, blank=True, null=True)
    nationality = models.CharField(max_length=100, blank=True, null=True)
    phone = models.CharField(max_length=50, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)

    photo = models.ForeignKey(
        get_image_model_string(),
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )

    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="reported"
    )
    category = models.CharField(
        max_length=30, choices=CATEGORY_CHOICES, default="other"
    )
    risk_level = models.CharField(
        max_length=10, choices=RISK_LEVEL_CHOICES, default="medium"
    )

    incident_date = models.DateField(blank=True, null=True)
    incident_location = models.CharField(max_length=255, blank=True, null=True)

    description = RichTextField(
        blank=True,
        null=True,
        help_text="Public description of the incident.",
    )
    internal_notes = models.TextField(
        blank=True,
        null=True,
        help_text="Staff-only notes. Never exposed in the public API.",
    )

    source = models.CharField(max_length=255, blank=True, null=True)
    is_verified = models.BooleanField(default=False)
    verified_by = models.CharField(max_length=200, blank=True, null=True)
    verified_at = models.DateTimeField(blank=True, null=True)

    visibility = models.CharField(
        max_length=10, choices=VISIBILITY_CHOICES, default="private"
    )

    created_by = models.CharField(max_length=200, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    legacy_case_data = models.JSONField(
        blank=True,
        null=True,
        help_text="Raw data imported from the old ListaNegra project.",
    )

    panels = [
        MultiFieldPanel(
            [
                FieldPanel("case_id", read_only=True),
                FieldPanel("full_name"),
                FieldPanel("aliases"),
            ],
            heading="Identity",
        ),
        MultiFieldPanel(
            [
                FieldPanel("id_type"),
                FieldPanel("identification"),
                FieldPanel("nationality"),
                FieldPanel("phone"),
                FieldPanel("email"),
            ],
            heading="Identification",
        ),
        FieldPanel("photo"),
        MultiFieldPanel(
            [
                FieldPanel("status"),
                FieldPanel("category"),
                FieldPanel("risk_level"),
                FieldPanel("visibility"),
            ],
            heading="Case Status",
        ),
        MultiFieldPanel(
            [
                FieldPanel("incident_date"),
                FieldPanel("incident_location"),
            ],
            heading="Incident",
        ),
        FieldPanel("description"),
        FieldPanel("internal_notes"),
        MultiFieldPanel(
            [
                FieldPanel("source"),
                FieldPanel("is_verified"),
                FieldPanel("verified_by"),
                FieldPanel("verified_at", read_only=True),
            ],
            heading="Verification",
        ),
        InlinePanel("images", label="Images"),
        InlinePanel("reporters", label="Reporters / Victims"),
        FieldPanel("legacy_case_data", read_only=True),
    ]

    def __str__(self):
        return f"{self.case_id} - {self.full_name or 'Unknown'}"

    def save(self, *args, **kwargs):
        changed_by = kwargs.pop("_changed_by", None)
        is_new = self.pk is None

        # Capture old values for existing records
        old_values = {}
        if not is_new:
            try:
                old = self.__class__.objects.get(pk=self.pk)
                old_values = {
                    "status": old.status,
                    "visibility": old.visibility,
                    "full_name": old.full_name,
                    "identification": old.identification,
                }
            except self.__class__.DoesNotExist:
                pass

        if not self.case_id:
            prefix = self.get_code_prefix()
            self.case_id = generate_case_id(prefix)
            while self.__class__.objects.filter(case_id=self.case_id).exists():
                self.case_id = generate_case_id(prefix)
        # Duplicate detection on identification number
        if self.identification:
            existing = (
                self.__class__.objects.filter(identification=self.identification)
                .exclude(pk=self.pk)
                .first()
            )
            if existing:
                from django.core.exceptions import ValidationError

                raise ValidationError(
                    {
                        "identification": f"A record with this ID number already exists (case {existing.case_id})."
                    }
                )
        super().save(*args, **kwargs)

        # Create audit log entry
        if is_new:
            BlacklistAuditLog.objects.create(
                person=self,
                action="created",
                changed_by=changed_by,
                notes="Record created",
            )
        else:
            # Log status changes
            if old_values.get("status") != self.status:
                BlacklistAuditLog.objects.create(
                    person=self,
                    action="status_changed",
                    changed_by=changed_by,
                    field_name="status",
                    old_value=old_values.get("status"),
                    new_value=self.status,
                )
            # Log visibility changes
            if old_values.get("visibility") != self.visibility:
                BlacklistAuditLog.objects.create(
                    person=self,
                    action="visibility_changed",
                    changed_by=changed_by,
                    field_name="visibility",
                    old_value=old_values.get("visibility"),
                    new_value=self.visibility,
                )
            # Log general update
            BlacklistAuditLog.objects.create(
                person=self,
                action="updated",
                changed_by=changed_by,
                notes="Record updated",
            )

    def get_code_prefix(self):
        return "LN"

    def masked_identification(self):
        """Return a masked version of the ID for public display."""
        if not self.identification:
            return None
        if len(self.identification) <= 4:
            return "*" * len(self.identification)
        return "*" * (len(self.identification) - 4) + self.identification[-4:]

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Blacklisted Person"
        verbose_name_plural = "Blacklisted People"


class ReportSubmissionImage(models.Model):
    """Images attached to a public report submission (pending review)."""

    submission = ParentalKey(
        "blacklist.ReportSubmission",
        on_delete=models.CASCADE,
        related_name="submission_images",
    )
    image = models.ForeignKey(
        get_image_model_string(),
        on_delete=models.CASCADE,
        related_name="+",
    )
    caption = models.CharField(max_length=250, blank=True, null=True)

    panels = ["image", "caption"]

    class Meta:
        ordering = ["id"]


@register_snippet
class ReportSubmission(ClusterableModel):
    """A public report submission awaiting staff review.

    Submissions are created by the public via the API and must be
    reviewed and approved by staff before becoming a BlacklistedPerson.
    """

    STATUS_CHOICES = [
        ("pending", "Pending Review"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
    ]

    submission_id = models.CharField(max_length=20, unique=True, editable=False)
    full_name = models.CharField(max_length=200, blank=True, null=True)
    aliases = models.CharField(max_length=200, blank=True, null=True)

    id_type = models.CharField(
        choices=[("Passport", "Passport"), ("ID_Card", "ID Card (Cédula)")],
        max_length=20,
        blank=True,
        null=True,
        verbose_name="Type of Identification",
    )
    identification = models.CharField(max_length=36, blank=True, null=True)
    nationality = models.CharField(max_length=100, blank=True, null=True)
    phone = models.CharField(max_length=50, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)

    category = models.CharField(
        max_length=30, choices=BlacklistedPerson.CATEGORY_CHOICES, default="other"
    )
    incident_date = models.DateField(blank=True, null=True)
    incident_location = models.CharField(max_length=255, blank=True, null=True)

    description = models.TextField(blank=True, null=True)

    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="pending")
    rejection_reason = models.TextField(blank=True, null=True)

    submitted_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(blank=True, null=True)
    reviewed_by = models.CharField(max_length=200, blank=True, null=True)

    # Link to the approved BlacklistedPerson (if any)
    approved_person = models.ForeignKey(
        BlacklistedPerson,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="submissions",
    )

    panels = [
        FieldPanel("submission_id", read_only=True),
        MultiFieldPanel(
            [
                FieldPanel("full_name"),
                FieldPanel("aliases"),
            ],
            heading="Identity",
        ),
        MultiFieldPanel(
            [
                FieldPanel("id_type"),
                FieldPanel("identification"),
                FieldPanel("nationality"),
                FieldPanel("phone"),
                FieldPanel("email"),
            ],
            heading="Identification",
        ),
        FieldPanel("category"),
        MultiFieldPanel(
            [
                FieldPanel("incident_date"),
                FieldPanel("incident_location"),
            ],
            heading="Incident",
        ),
        FieldPanel("description"),
        InlinePanel("submission_images", label="Images"),
        MultiFieldPanel(
            [
                FieldPanel("status", read_only=True),
                FieldPanel("rejection_reason"),
                FieldPanel("reviewed_by", read_only=True),
                FieldPanel("reviewed_at", read_only=True),
            ],
            heading="Review",
        ),
    ]

    def __str__(self):
        return f"{self.submission_id} - {self.full_name or 'Unknown'} ({self.status})"

    def save(self, *args, **kwargs):
        if not self.submission_id:
            self.submission_id = generate_case_id("RS")
            while self.__class__.objects.filter(submission_id=self.submission_id).exists():
                self.submission_id = generate_case_id("RS")
        super().save(*args, **kwargs)

    class Meta:
        ordering = ["-submitted_at"]
        verbose_name = "Report Submission"
        verbose_name_plural = "Report Submissions"


@register_snippet
class BlacklistAuditLog(models.Model):
    """Audit trail for changes to blacklist records."""

    ACTION_CHOICES = [
        ("created", "Created"),
        ("updated", "Updated"),
        ("status_changed", "Status Changed"),
        ("visibility_changed", "Visibility Changed"),
        ("deleted", "Deleted"),
    ]

    person = models.ForeignKey(
        BlacklistedPerson,
        on_delete=models.CASCADE,
        related_name="audit_logs",
    )
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    changed_by = models.CharField(max_length=200, blank=True, null=True)
    changed_at = models.DateTimeField(auto_now_add=True)
    field_name = models.CharField(max_length=100, blank=True, null=True)
    old_value = models.TextField(blank=True, null=True)
    new_value = models.TextField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)

    panels = [
        FieldPanel("person", read_only=True),
        FieldPanel("action", read_only=True),
        FieldPanel("changed_by", read_only=True),
        FieldPanel("changed_at", read_only=True),
        FieldPanel("field_name", read_only=True),
        FieldPanel("old_value", read_only=True),
        FieldPanel("new_value", read_only=True),
        FieldPanel("notes", read_only=True),
    ]

    def __str__(self):
        return f"{self.person.case_id} - {self.action} by {self.changed_by}"

    class Meta:
        ordering = ["-changed_at"]
        verbose_name = "Blacklist Audit Log"
        verbose_name_plural = "Blacklist Audit Logs"


