from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .viewsets import (
    PropertyViewSet,
    PropertyInquiryViewSet,
    TenantApplicationViewSet,
    SavedSearchViewSet,
    LeadViewSet,
    LeadMatchViewSet,
    ProjectViewSet,
    ProjectUnitViewSet,
    AnalyticsViewSet,
    WhatsAppImportViewSet,
)
from .social_post import SocialPostDownloadView

router = DefaultRouter()
router.register(r"properties", PropertyViewSet, basename="estate-property")
router.register(r"inquiries", PropertyInquiryViewSet, basename="estate-inquiry")
router.register(r"applications", TenantApplicationViewSet, basename="estate-application")
router.register(r"saved-searches", SavedSearchViewSet, basename="estate-saved-search")
router.register(r"leads", LeadViewSet, basename="estate-lead")
router.register(r"lead-matches", LeadMatchViewSet, basename="estate-lead-match")
router.register(r"projects", ProjectViewSet, basename="estate-project")
router.register(r"project-units", ProjectUnitViewSet, basename="estate-project-unit")
router.register(r"analytics", AnalyticsViewSet, basename="estate-analytics")
router.register(r"whatsapp-import", WhatsAppImportViewSet, basename="estate-whatsapp-import")

urlpatterns = [
    path("", include(router.urls)),
    path("properties/<slug:slug>/social-post/", SocialPostDownloadView.as_view(), name="estate-social-post"),
]
