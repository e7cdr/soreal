from rest_framework import permissions

from django.conf import settings


class IsStaffOrReadOnly(permissions.BasePermission):
    """Staff can write; everyone else is read-only."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user and request.user.is_staff


class BlacklistSectionAccess(permissions.BasePermission):
    """Optional section-wide password gate for the public blacklist API."""

    def has_permission(self, request, view):
        password = getattr(settings, "BLACKLIST_ACCESS_PASSWORD", "")
        if not password:
            # No password configured: section is open.
            return True

        # Staff always bypass.
        if request.user and request.user.is_authenticated and request.user.is_staff:
            return True

        # Check for a valid session token set by the unlock view.
        token = request.session.get("blacklist_access_token")
        if token:
            # Simple token validation: the token IS the password (session-bound).
            return token == password

        return False

    def has_object_permission(self, request, view, obj):
        return self.has_permission(request, view)
