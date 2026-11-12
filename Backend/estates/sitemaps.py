from django.conf import settings


def get_site_url():
    """Return the public site URL for sitemap links."""
    return getattr(settings, "SITE_URL", "http://localhost:3000").rstrip("/")


class PropertySitemapItems:
    """Lazy iterable of available property URLs for the sitemap."""

    def __iter__(self):
        from .models import Property

        for prop in Property.objects.filter(status="available").only("slug", "updated_at"):
            yield {
                "slug": prop.slug,
                "lastmod": prop.updated_at,
            }

    def __len__(self):
        from .models import Property

        return Property.objects.filter(status="available").count()
