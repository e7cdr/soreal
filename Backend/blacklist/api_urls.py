from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .viewsets import BlacklistedPersonViewSet, ReportSubmissionViewSet
from .auth_views import StaffLoginView

router = DefaultRouter()
router.register(r"persons", BlacklistedPersonViewSet, basename="blacklist-person")
router.register(r"submissions", ReportSubmissionViewSet, basename="report-submission")

urlpatterns = [
    path("auth/login/", StaffLoginView.as_view(), name="staff-login"),
    path("", include(router.urls)),
]
