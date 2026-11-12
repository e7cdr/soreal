from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .viewsets import (
    PropertyViewSet,
    PropertyInquiryViewSet,
    TenantApplicationViewSet,
    SavedSearchViewSet,
    LeadViewSet,
    LeadLeadMatchViewSet,
    LeadMatchViewSet,
    BrokerViewSet,
    OwnerViewSet,
    DataQualityViewSet,
    ScanInboxViewSet,
    ProjectViewSet,
    ProjectUnitViewSet,
    AnalyticsViewSet,
    WhatsAppImportViewSet,
    MarketingPostViewSet,
)
from .social_post import SocialPostDownloadView

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

urlpatterns = [
    path("", include(router.urls)),
    path("properties/<slug:slug>/social-post/", SocialPostDownloadView.as_view(), name="estate-social-post"),
]
