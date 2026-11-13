from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .viewsets import (
    AdCampaignViewSet,
    AudioTrackViewSet,
    BrokerViewSet,
    OwnerViewSet,
    PropertyViewSet,
    PropertyInquiryViewSet,
    ReelSlideViewSet,
    ReelTemplateViewSet,
    ReelViewSet,
    SavedSearchViewSet,
    TenantApplicationViewSet,
    LeadViewSet,
    LeadLeadMatchViewSet,
    LeadMatchViewSet,
    MarketingPostViewSet,
    ProjectViewSet,
    ProjectUnitViewSet,
    AnalyticsViewSet,
    WhatsAppImportViewSet,
    ScanInboxViewSet,
    DataQualityViewSet,
)
from .social_post import SocialPostDownloadView
from .pdf_views import BulkEstatePdfView, EstatePdfView

router = DefaultRouter()
router.register(r"properties", PropertyViewSet, basename="estate-property")
router.register(r"inquiries", PropertyInquiryViewSet, basename="estate-inquiry")
router.register(r"applications", TenantApplicationViewSet, basename="estate-application")
router.register(r"saved-searches", SavedSearchViewSet, basename="estate-saved-search")
router.register(r"leads", LeadViewSet, basename="estate-lead")
router.register(r"lead-matches", LeadMatchViewSet, basename="estate-lead-match")
router.register(
    r"lead-lead-matches",
    LeadLeadMatchViewSet,
    basename="estate-lead-lead-match",
)
router.register(r"brokers", BrokerViewSet, basename="estate-broker")
router.register(r"owners", OwnerViewSet, basename="estate-owner")
router.register(r"data-quality", DataQualityViewSet, basename="estate-data-quality")
router.register(r"scan-inbox", ScanInboxViewSet, basename="estate-scan-inbox")
router.register(r"projects", ProjectViewSet, basename="estate-project")
router.register(r"project-units", ProjectUnitViewSet, basename="estate-project-unit")
router.register(r"analytics", AnalyticsViewSet, basename="estate-analytics")
router.register(r"whatsapp-import", WhatsAppImportViewSet, basename="estate-whatsapp-import")
router.register(r"marketing-posts", MarketingPostViewSet, basename="estate-marketing-post")
router.register(r"ad-campaigns", AdCampaignViewSet, basename="estate-ad-campaign")
router.register(r"reels", ReelViewSet, basename="estate-reel")
router.register(r"reel-slides", ReelSlideViewSet, basename="estate-reel-slide")
router.register(r"reel-templates", ReelTemplateViewSet, basename="estate-reel-template")
router.register(r"audio-tracks", AudioTrackViewSet, basename="estate-audio-track")

urlpatterns = [
    path(
        "properties/bulk-pdf/",
        BulkEstatePdfView.as_view(),
        name="estate-bulk-pdf",
    ),
    path(
        "properties/<slug:slug>/pdf/",
        EstatePdfView.as_view(),
        name="estate-pdf",
    ),
    path("", include(router.urls)),
    path("properties/<slug:slug>/social-post/", SocialPostDownloadView.as_view(), name="estate-social-post"),
]
