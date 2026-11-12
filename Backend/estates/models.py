import secrets
import string

from django.db import models
from django.utils.text import slugify
from modelcluster.fields import ParentalKey
from modelcluster.models import ClusterableModel
from wagtail.models import Orderable
from wagtail.admin.panels import FieldPanel, MultiFieldPanel, InlinePanel
from wagtail.fields import RichTextField
from wagtail.images import get_image_model_string
from wagtail.snippets.models import register_snippet


def _new_custom_id(prefix):
    alphabet = string.ascii_uppercase + string.digits
    return f"{prefix}-" + "".join(secrets.choice(alphabet) for _ in range(5))


class PropertyImage(Orderable):
    """Images attached to a property listing."""

    property = ParentalKey(
        "estates.Property",
        on_delete=models.CASCADE,
        related_name="images",
    )
    image = models.ForeignKey(
        get_image_model_string(),
        on_delete=models.CASCADE,
        related_name="+",
    )
    caption = models.CharField(max_length=250, blank=True, null=True)
    is_cover = models.BooleanField(default=False)

    panels = ["image", "caption", "is_cover"]

    class Meta:
        ordering = ["sort_order"]


@register_snippet
class Property(ClusterableModel):
    """A real estate listing (sale or rent)."""

    PROPERTY_TYPE_CHOICES = [
        ("house", "House"),
        ("apartment", "Apartment"),
        ("land", "Land"),
        ("commercial", "Commercial"),
        ("villa", "Villa"),
    ]

    LISTING_TYPE_CHOICES = [
        ("sale", "For Sale"),
        ("rent", "For Rent"),
    ]

    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("available", "Available"),
        ("reserved", "Reserved"),
        ("sold", "Sold"),
        ("rented", "Rented"),
        ("inactive", "Inactive"),
    ]

    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    custom_id = models.CharField(max_length=8, unique=True, editable=False)
    description = RichTextField(blank=True, null=True)
    meta_title = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="SEO title tag. Auto-generated from title + city if left blank.",
    )
    meta_description = models.TextField(
        blank=True,
        null=True,
        help_text="SEO meta description. Auto-generated from description if left blank.",
    )

    # Source attribution for scraped listings
    source_site = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="Origin site name (e.g., OLX, ZonaProp).",
    )
    source_url = models.URLField(
        max_length=500,
        blank=True,
        null=True,
        help_text="Canonical URL of the original listing.",
    )
    source_imported_at = models.DateTimeField(
        blank=True,
        null=True,
        help_text="When this listing was scraped into SOREAL.",
    )
    source_verified = models.BooleanField(
        default=False,
        help_text="Has an agent reviewed and confirmed this data?",
    )
    source_hash = models.CharField(
        max_length=64,
        blank=True,
        null=True,
        unique=True,
        help_text="Content hash to detect cross-site duplicates.",
    )
    source_status = models.CharField(
        max_length=20,
        default="draft",
        help_text="draft, verified, or rejected",
    )

    # Buyer persona / ideal customer profiling
    persona_name = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="Ideal customer persona (e.g., Young Family, Investor, Retiree).",
    )
    persona_demographics = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Age range, budget, preferred location, bedrooms.",
    )
    persona_motivations = models.TextField(
        blank=True,
        null=True,
        help_text="What drives this buyer (e.g., first home, investment, retirement).",
    )
    persona_objections = models.TextField(
        blank=True,
        null=True,
        help_text="Common objections and how to address them.",
    )
    persona_marketing_angle = models.TextField(
        blank=True,
        null=True,
        help_text="Storytelling hook and ad copy angle for this persona.",
    )

    property_type = models.CharField(
        max_length=30, choices=PROPERTY_TYPE_CHOICES, default="house"
    )
    listing_type = models.CharField(
        max_length=20, choices=LISTING_TYPE_CHOICES, default="sale"
    )

    price = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=10, default="DOP")

    bedrooms = models.PositiveIntegerField(null=True, blank=True)
    bathrooms = models.PositiveIntegerField(null=True, blank=True)
    area_sqm = models.PositiveIntegerField(null=True, blank=True)

    address = models.CharField(max_length=255, blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    province = models.CharField(max_length=100, blank=True, null=True)
    latitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    longitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )

    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="draft"
    )
    featured = models.BooleanField(default=False)

    amenities = models.JSONField(
        default=list,
        blank=True,
        help_text="List of amenities (e.g., ['pool', 'parking', 'ac']).",
    )

    created_by = models.CharField(max_length=200, blank=True, null=True)
    broker = models.ForeignKey(
        "estates.Broker",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="properties",
    )
    owner = models.ForeignKey(
        "estates.Owner",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="properties",
    )
    source_lead = models.OneToOneField(
        "estates.Lead",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_property",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    panels = [
        MultiFieldPanel(
            [
                FieldPanel("title"),
                FieldPanel("slug"),
                FieldPanel("custom_id", read_only=True),
                FieldPanel("description"),
                FieldPanel("meta_title"),
                FieldPanel("meta_description"),
            ],
            heading="Basic Info",
        ),
        MultiFieldPanel(
            [
                FieldPanel("source_site"),
                FieldPanel("source_url"),
                FieldPanel("source_verified"),
                FieldPanel("source_status"),
            ],
            heading="Source Attribution",
        ),
        MultiFieldPanel(
            [
                FieldPanel("persona_name"),
                FieldPanel("persona_demographics"),
                FieldPanel("persona_motivations"),
                FieldPanel("persona_objections"),
                FieldPanel("persona_marketing_angle"),
            ],
            heading="Buyer Persona",
        ),
        MultiFieldPanel(
            [
                FieldPanel("property_type"),
                FieldPanel("listing_type"),
                FieldPanel("status"),
                FieldPanel("featured"),
            ],
            heading="Listing Details",
        ),
        MultiFieldPanel(
            [
                FieldPanel("price"),
                FieldPanel("currency"),
                FieldPanel("bedrooms"),
                FieldPanel("bathrooms"),
                FieldPanel("area_sqm"),
            ],
            heading="Pricing & Size",
        ),
        MultiFieldPanel(
            [
                FieldPanel("address"),
                FieldPanel("city"),
                FieldPanel("province"),
                FieldPanel("latitude"),
                FieldPanel("longitude"),
            ],
            heading="Location",
        ),
        FieldPanel("amenities"),
        FieldPanel("broker"),
        FieldPanel("owner"),
        InlinePanel("images", label="Images"),
        FieldPanel("created_by", read_only=True),
    ]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.custom_id:
            prefix = "RQ" if self.source_lead_id else "NM"
            for _ in range(100):
                custom_id = _new_custom_id(prefix)
                if not Property.objects.filter(custom_id=custom_id).exists():
                    self.custom_id = custom_id
                    break
            else:
                raise RuntimeError("Unable to generate a unique estate ID.")
        if not self.slug:
            self.slug = slugify(self.title)
        super().save(*args, **kwargs)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Property"
        verbose_name_plural = "Properties"


@register_snippet
class PropertyInquiry(models.Model):
    """A buyer/renter inquiry about a property."""

    STATUS_CHOICES = [
        ("new", "New"),
        ("contacted", "Contacted"),
        ("closed", "Closed"),
    ]

    SCREENING_STATUS_CHOICES = [
        ("not_screened", "Not Screened"),
        ("clean", "Clean"),
        ("flagged", "Flagged"),
        ("review", "Under Review"),
    ]

    property = models.ForeignKey(
        Property,
        on_delete=models.CASCADE,
        related_name="inquiries",
    )
    name = models.CharField(max_length=200)
    email = models.EmailField()
    phone = models.CharField(max_length=50, blank=True, null=True)
    id_type = models.CharField(
        choices=[("Passport", "Passport"), ("ID_Card", "ID Card (Cédula)")],
        max_length=20,
        blank=True,
        null=True,
        verbose_name="Type of Identification",
    )
    identification = models.CharField(max_length=36, blank=True, null=True)
    message = models.TextField(blank=True, null=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="new")
    screening_status = models.CharField(
        max_length=20,
        choices=SCREENING_STATUS_CHOICES,
        default="not_screened",
    )
    screening_notes = models.TextField(blank=True, null=True)
    screened_by = models.CharField(max_length=200, blank=True, null=True)
    screened_at = models.DateTimeField(blank=True, null=True)
    matched_person = models.ForeignKey(
        "blacklist.BlacklistedPerson",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="inquiry_matches",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    panels = [
        FieldPanel("property", read_only=True),
        FieldPanel("name"),
        FieldPanel("email"),
        FieldPanel("phone"),
        FieldPanel("id_type"),
        FieldPanel("identification"),
        FieldPanel("message"),
        FieldPanel("status", read_only=True),
        FieldPanel("screening_status", read_only=True),
        FieldPanel("screening_notes"),
        FieldPanel("screened_by", read_only=True),
        FieldPanel("screened_at", read_only=True),
        FieldPanel("matched_person", read_only=True),
        FieldPanel("created_at", read_only=True),
    ]

    def __str__(self):
        return f"Inquiry for {self.property.title} by {self.name}"

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Property Inquiry"
        verbose_name_plural = "Property Inquiries"


@register_snippet
class TenantApplication(models.Model):
    """A formal tenant application linked to a property inquiry and blacklist screening."""

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
    ]

    inquiry = models.OneToOneField(
        PropertyInquiry,
        on_delete=models.CASCADE,
        related_name="application",
    )
    blacklisted_person = models.ForeignKey(
        "blacklist.BlacklistedPerson",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tenant_applications",
    )
    screening_status = models.CharField(
        max_length=20,
        choices=[
            ("clean", "Clean"),
            ("flagged", "Flagged"),
            ("review", "Under Review"),
        ],
        default="clean",
    )
    screening_notes = models.TextField(blank=True, null=True)
    decision = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    decision_notes = models.TextField(blank=True, null=True)
    decided_by = models.CharField(max_length=200, blank=True, null=True)
    decided_at = models.DateTimeField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    panels = [
        FieldPanel("inquiry", read_only=True),
        FieldPanel("blacklisted_person", read_only=True),
        FieldPanel("screening_status", read_only=True),
        FieldPanel("screening_notes"),
        FieldPanel("decision"),
        FieldPanel("decision_notes"),
        FieldPanel("decided_by", read_only=True),
        FieldPanel("decided_at", read_only=True),
        FieldPanel("created_at", read_only=True),
        FieldPanel("updated_at", read_only=True),
    ]

    def __str__(self):
        return f"Application for {self.inquiry.property.title} by {self.inquiry.name}"

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Tenant Application"
        verbose_name_plural = "Tenant Applications"


@register_snippet
class SavedSearch(models.Model):
    """A saved property search with optional email notifications."""

    name = models.CharField(max_length=200)
    email = models.EmailField(blank=True, null=True)
    filters = models.JSONField(
        default=dict,
        help_text="Stored filter parameters (city, property_type, price range, etc.).",
    )
    is_active = models.BooleanField(default=True)
    last_notified_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    panels = [
        FieldPanel("name"),
        FieldPanel("email"),
        FieldPanel("filters"),
        FieldPanel("is_active"),
        FieldPanel("last_notified_at", read_only=True),
        FieldPanel("created_at", read_only=True),
    ]

    def __str__(self):
        return self.name

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Saved Search"
        verbose_name_plural = "Saved Searches"


@register_snippet
class Lead(models.Model):
    """A lead from WhatsApp groups or manual entry - someone looking for a property."""

    STATUS_CHOICES = [
        ("new", "New"),
        ("contacted", "Contacted"),
        ("matched", "Matched"),
        ("completed", "Completed"),
        ("unavailable", "No Longer Available"),
        ("ignored", "Ignored User"),
        ("closed", "Closed"),
    ]

    LISTING_TYPE_CHOICES = [
        ("sale", "For Sale"),
        ("rent", "For Rent"),
        ("any", "Any"),
    ]

    name = models.CharField(max_length=200)
    phone = models.CharField(max_length=50, blank=True)
    source_sender = models.CharField(max_length=200, blank=True, default="")
    broker = models.ForeignKey(
        "estates.Broker",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="requests",
    )
    whatsapp_group = models.CharField(
        max_length=200, blank=True, null=True,
        help_text="WhatsApp group name where this lead was found",
    )
    source = models.CharField(
        max_length=50, default="whatsapp",
        help_text="Where this lead came from (whatsapp, manual, referral, etc.)",
    )

    # What they're looking for
    listing_type = models.CharField(
        max_length=20, choices=LISTING_TYPE_CHOICES, default="any"
    )
    property_type = models.CharField(
        max_length=30, blank=True, null=True,
        help_text="House, Apartment, Land, Commercial, Villa",
    )
    min_bedrooms = models.PositiveIntegerField(blank=True, null=True)
    max_bedrooms = models.PositiveIntegerField(blank=True, null=True)
    min_bathrooms = models.PositiveIntegerField(blank=True, null=True)
    max_bathrooms = models.PositiveIntegerField(blank=True, null=True)
    min_price = models.DecimalField(max_digits=14, decimal_places=2, blank=True, null=True)
    max_price = models.DecimalField(max_digits=14, decimal_places=2, blank=True, null=True)
    budget_currency = models.CharField(max_length=10, blank=True, null=True)
    preferred_location = models.CharField(max_length=200, blank=True, null=True)
    furnishing = models.CharField(max_length=20, blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    province = models.CharField(max_length=100, blank=True, null=True)

    notes = models.TextField(blank=True, null=True)
    attachments = models.JSONField(default=list, blank=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="new")
    status_before_ignored = models.CharField(max_length=20, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    panels = [
        FieldPanel("name"),
        FieldPanel("phone"),
        FieldPanel("source_sender", read_only=True),
        FieldPanel("broker"),
        FieldPanel("whatsapp_group"),
        FieldPanel("source"),
        MultiFieldPanel(
            [
                FieldPanel("listing_type"),
                FieldPanel("property_type"),
                FieldPanel("min_bedrooms"),
                FieldPanel("max_bedrooms"),
                FieldPanel("min_bathrooms"),
                FieldPanel("max_bathrooms"),
                FieldPanel("min_price"),
                FieldPanel("max_price"),
                FieldPanel("budget_currency"),
                FieldPanel("preferred_location"),
                FieldPanel("furnishing"),
                FieldPanel("city"),
                FieldPanel("province"),
            ],
            heading="Looking For",
        ),
        FieldPanel("notes"),
        FieldPanel("status"),
    ]

    def __str__(self):
        return f"Lead: {self.name} ({self.phone})"

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Lead"
        verbose_name_plural = "Leads"


@register_snippet
class Broker(models.Model):
    """A broker/contact in the shared SOREAL directory."""

    name = models.CharField(max_length=200)
    phone = models.CharField(max_length=50, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    company = models.CharField(max_length=200, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    panels = [
        FieldPanel("name"),
        FieldPanel("phone"),
        FieldPanel("email"),
        FieldPanel("company"),
        FieldPanel("notes"),
    ]

    def __str__(self):
        return f"{self.name} ({self.company})" if self.company else self.name

    class Meta:
        ordering = ["name"]


@register_snippet
class Owner(models.Model):
    """A property owner or project owner in the SOREAL directory."""

    name = models.CharField(max_length=200)
    phone = models.CharField(max_length=50, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    company = models.CharField(max_length=200, blank=True, default="")
    identification = models.CharField(max_length=50, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    panels = [
        FieldPanel("name"),
        FieldPanel("phone"),
        FieldPanel("email"),
        FieldPanel("company"),
        FieldPanel("identification"),
        FieldPanel("notes"),
    ]

    def __str__(self):
        return f"{self.name} ({self.company})" if self.company else self.name

    class Meta:
        ordering = ["name"]


class WhatsAppIgnoredUser(models.Model):
    """A WhatsApp sender excluded from all future chat imports."""

    sender_key = models.CharField(max_length=220, unique=True)
    sender_name = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sender_name"]
        verbose_name = "Ignored WhatsApp sender"
        verbose_name_plural = "Ignored WhatsApp senders"

    def __str__(self):
        return self.sender_name


class ScanInboxItem(models.Model):
    """A scanned WhatsApp message that needs a person to classify it."""

    STATUS_CHOICES = [
        ("pending", "Needs review"),
        ("request", "Saved as request"),
        ("broker", "Saved as broker"),
        ("estate", "Saved as estate"),
        ("dismissed", "Dismissed"),
    ]

    fingerprint = models.CharField(max_length=64, unique=True)
    whatsapp_group = models.CharField(max_length=200)
    sender = models.CharField(max_length=200, blank=True, default="")
    message_date = models.CharField(max_length=20, blank=True, default="")
    message_time = models.CharField(max_length=30, blank=True, default="")
    message = models.TextField(blank=True, default="")
    attachments = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    lead = models.ForeignKey(
        Lead,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="scan_inbox_items",
    )
    broker = models.ForeignKey(
        Broker,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="scan_inbox_items",
    )
    property = models.ForeignKey(
        Property,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="scan_inbox_items",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        verbose_name = "WhatsApp scan inbox item"
        verbose_name_plural = "WhatsApp scan inbox items"

    def __str__(self):
        return f"{self.sender}: {self.message[:80]}"


@register_snippet
class LeadMatch(models.Model):
    """A match between a lead and a property."""

    MATCH_STATUS_CHOICES = [
        ("pending", "Pending"),
        ("notified", "Notified"),
        ("contacted", "Contacted"),
        ("dismissed", "Dismissed"),
    ]

    lead = models.ForeignKey(
        Lead, on_delete=models.CASCADE, related_name="matches"
    )
    property = models.ForeignKey(
        Property, on_delete=models.CASCADE, related_name="lead_matches"
    )
    match_score = models.IntegerField(
        default=0,
        help_text="Higher score = better match (0-100)",
    )
    match_reasons = models.CharField(
        max_length=255, blank=True, null=True,
        help_text="Why this property matches the lead",
    )
    status = models.CharField(
        max_length=20, choices=MATCH_STATUS_CHOICES, default="pending"
    )
    notified_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    panels = [
        FieldPanel("lead", read_only=True),
        FieldPanel("property", read_only=True),
        FieldPanel("match_score", read_only=True),
        FieldPanel("match_reasons", read_only=True),
        FieldPanel("status"),
        FieldPanel("notified_at", read_only=True),
    ]

    def __str__(self):
        return f"Match: {self.lead.name} ↔ {self.property.title}"

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Lead Match"
        verbose_name_plural = "Lead Matches"
        unique_together = ["lead", "property"]


@register_snippet
class LeadLeadMatch(models.Model):
    """A match between two leads looking for similar properties."""

    MATCH_STATUS_CHOICES = [
        ("pending", "Pending"),
        ("notified", "Notified"),
        ("contacted", "Contacted"),
        ("dismissed", "Dismissed"),
    ]

    lead_a = models.ForeignKey(
        Lead, on_delete=models.CASCADE, related_name="lead_matches_a"
    )
    lead_b = models.ForeignKey(
        Lead, on_delete=models.CASCADE, related_name="lead_matches_b"
    )
    match_score = models.IntegerField(
        default=0,
        help_text="Higher score = better match (0-100)",
    )
    match_reasons = models.CharField(
        max_length=255, blank=True, null=True,
        help_text="Why these two leads match",
    )
    status = models.CharField(
        max_length=20, choices=MATCH_STATUS_CHOICES, default="pending"
    )
    notified_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    panels = [
        FieldPanel("lead_a", read_only=True),
        FieldPanel("lead_b", read_only=True),
        FieldPanel("match_score", read_only=True),
        FieldPanel("match_reasons", read_only=True),
        FieldPanel("status"),
        FieldPanel("notified_at", read_only=True),
    ]

    def __str__(self):
        return f"Lead Match: {self.lead_a.name} ↔ {self.lead_b.name}"

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Lead-Lead Match"
        verbose_name_plural = "Lead-Lead Matches"
        unique_together = ["lead_a", "lead_b"]
        constraints = [
            models.CheckConstraint(
                check=~models.Q(lead_a=models.F("lead_b")),
                name="lead_a_not_equal_lead_b",
            ),
        ]


@register_snippet
class Project(models.Model):
    """A real estate development project with multiple units for sale/rent."""

    STATUS_CHOICES = [
        ("planning", "Planning"),
        ("under_construction", "Under Construction"),
        ("ready", "Ready for Delivery"),
        ("sold_out", "Sold Out"),
        ("cancelled", "Cancelled"),
    ]

    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200, unique=True, blank=True)
    custom_id = models.CharField(max_length=8, unique=True, editable=False)
    description = RichTextField(blank=True, null=True)
    developer = models.CharField(max_length=200, blank=True, null=True)
    broker = models.ForeignKey(
        "estates.Broker",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="projects",
    )
    owner = models.ForeignKey(
        "estates.Owner",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="projects",
    )
    address = models.CharField(max_length=255, blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    province = models.CharField(max_length=100, blank=True, null=True)

    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="planning"
    )
    total_units = models.PositiveIntegerField(default=0)
    available_units = models.PositiveIntegerField(default=0)

    created_by = models.CharField(max_length=200, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    panels = [
        MultiFieldPanel(
            [
                FieldPanel("name"),
                FieldPanel("slug"),
                FieldPanel("custom_id", read_only=True),
                FieldPanel("description"),
                FieldPanel("developer"),
                FieldPanel("broker"),
                FieldPanel("owner"),
            ],
            heading="Project Info",
        ),
        MultiFieldPanel(
            [
                FieldPanel("address"),
                FieldPanel("city"),
                FieldPanel("province"),
            ],
            heading="Location",
        ),
        FieldPanel("status"),
        FieldPanel("total_units"),
        FieldPanel("available_units"),
    ]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.custom_id:
            for _ in range(100):
                custom_id = _new_custom_id("PR")
                if not Project.objects.filter(custom_id=custom_id).exists():
                    self.custom_id = custom_id
                    break
            else:
                raise RuntimeError("Unable to generate a unique project ID.")
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Project"
        verbose_name_plural = "Projects"


class ProjectUnit(models.Model):
    """An individual unit within a project."""

    UNIT_STATUS_CHOICES = [
        ("available", "Available"),
        ("reserved", "Reserved"),
        ("sold", "Sold"),
        ("rented", "Rented"),
        ("unavailable", "Unavailable"),
    ]

    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="units"
    )
    unit_number = models.CharField(max_length=50)
    unit_type = models.CharField(
        max_length=30, blank=True, null=True,
        help_text="Studio, 1BR, 2BR, 3BR, Penthouse, etc.",
    )
    bedrooms = models.PositiveIntegerField(blank=True, null=True)
    bathrooms = models.PositiveIntegerField(blank=True, null=True)
    area_sqm = models.PositiveIntegerField(blank=True, null=True)

    price = models.DecimalField(max_digits=14, decimal_places=2, blank=True, null=True)
    currency = models.CharField(max_length=10, default="DOP")

    status = models.CharField(
        max_length=20, choices=UNIT_STATUS_CHOICES, default="available"
    )
    floor = models.PositiveIntegerField(blank=True, null=True)
    orientation = models.CharField(
        max_length=20, blank=True, null=True,
        help_text="North, South, East, West, etc.",
    )
    notes = models.TextField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    panels = [
        FieldPanel("project", read_only=True),
        FieldPanel("unit_number"),
        FieldPanel("unit_type"),
        FieldPanel("bedrooms"),
        FieldPanel("bathrooms"),
        FieldPanel("area_sqm"),
        FieldPanel("price"),
        FieldPanel("currency"),
        FieldPanel("status"),
        FieldPanel("floor"),
        FieldPanel("orientation"),
        FieldPanel("notes"),
    ]

    def __str__(self):
        return f"{self.project.name} - Unit {self.unit_number}"

    class Meta:
        ordering = ["project", "unit_number"]
        unique_together = ["project", "unit_number"]
        verbose_name = "Project Unit"
        verbose_name_plural = "Project Units"


@register_snippet
class ProjectBulkUpload(models.Model):
    """Track bulk unit upload jobs for a project."""

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("processing", "Processing"),
        ("completed", "Completed"),
        ("failed", "Failed"),
    ]

    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="bulk_uploads"
    )
    upload_file = models.FileField(upload_to="project_uploads/")
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="pending"
    )
    units_created = models.PositiveIntegerField(default=0)
    units_updated = models.PositiveIntegerField(default=0)
    errors = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(blank=True, null=True)

    panels = [
        FieldPanel("project", read_only=True),
        FieldPanel("status", read_only=True),
        FieldPanel("units_created", read_only=True),
        FieldPanel("units_updated", read_only=True),
        FieldPanel("errors", read_only=True),
        FieldPanel("created_at", read_only=True),
    ]

    def __str__(self):
        return f"Bulk upload {self.project.name} - {self.status}"

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Project Bulk Upload"
        verbose_name_plural = "Project Bulk Uploads"


class MarketingPost(models.Model):
    """A planned social media post for promoting an estate or general content."""

    PLATFORM_CHOICES = [
        ("instagram", "Instagram"),
        ("facebook", "Facebook"),
        ("whatsapp", "WhatsApp Status"),
    ]

    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("scheduled", "Scheduled"),
        ("posted", "Posted"),
    ]

    title = models.CharField(max_length=255, blank=True, null=True)
    caption = models.TextField(blank=True, null=True)
    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES, default="instagram")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")
    scheduled_for = models.DateTimeField(blank=True, null=True)
    posted_at = models.DateTimeField(blank=True, null=True)
    estate = models.ForeignKey(
        Property, on_delete=models.SET_NULL, null=True, blank=True, related_name="marketing_posts"
    )
    media_url = models.URLField(blank=True, null=True)
    created_by = models.CharField(max_length=200, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    panels = [
        FieldPanel("title"),
        FieldPanel("caption"),
        FieldPanel("platform"),
        FieldPanel("status"),
        FieldPanel("scheduled_for"),
        FieldPanel("estate"),
        FieldPanel("media_url"),
    ]

    def __str__(self):
        return f"{self.platform}: {self.title or self.caption[:50] or ''} ({self.status})"

    class Meta:
        ordering = ["-scheduled_for", "-created_at"]
        verbose_name = "Marketing Post"
        verbose_name_plural = "Marketing Posts"

