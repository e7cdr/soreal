from django.http import HttpResponse
from django.utils.xmlutils import SimplerXMLGenerator
from django.views.decorators.csrf import csrf_exempt

from .sitemaps import get_site_url


def _property_items():
    """Yield (slug, lastmod) for all available properties."""
    from .models import Property

    for prop in Property.objects.filter(status="available").only("slug", "updated_at"):
        yield prop.slug, prop.updated_at


@csrf_exempt
def robots_txt(request):
    """Serve a robots.txt that allows crawling of estate pages and the API."""
    lines = [
        "User-agent: *",
        "Allow: /",
        "Disallow: /django-admin/",
        "Disallow: /admin/",
        "Disallow: /api/",
        "",
        f"Sitemap: {get_site_url()}/sitemap.xml",
    ]
    return HttpResponse("\n".join(lines) + "\n", content_type="text/plain")


@csrf_exempt
def sitemap_xml(request):
    """Serve a sitemap.xml listing all available property pages."""
    site_url = get_site_url()
    urlset = []
    for slug, lastmod in _property_items():
        urlset.append(
            {
                "loc": f"{site_url}/estates/{slug}/",
                "lastmod": lastmod.isoformat() if lastmod else "",
                "changefreq": "weekly",
                "priority": "0.8",
            }
        )

    xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    for entry in urlset:
        xml += "  <url>\n"
        xml += f'    <loc>{entry["loc"]}</loc>\n'
        if entry["lastmod"]:
            xml += f'    <lastmod>{entry["lastmod"]}</lastmod>\n'
        xml += f'    <changefreq>{entry["changefreq"]}</changefreq>\n'
        xml += f'    <priority>{entry["priority"]}</priority>\n'
        xml += "  </url>\n"
    xml += "</urlset>\n"

    return HttpResponse(xml, content_type="application/xml")


@csrf_exempt
def health_check(request):
    """Health check endpoint for uptime monitoring.

    Returns 200 OK with a JSON body indicating the service is healthy.
    Includes a database connectivity check so monitors can detect
    database outages.
    """
    import json
    from django.db import connection
    from django.utils import timezone

    db_ok = True
    db_error = None
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except Exception as exc:  # pragma: no cover - defensive
        db_ok = False
        db_error = str(exc)

    status = "ok" if db_ok else "degraded"
    payload = {
        "status": status,
        "service": "soreal-backend",
        "timestamp": timezone.now().isoformat(),
        "database": "ok" if db_ok else f"error: {db_error}",
    }
    return HttpResponse(
        json.dumps(payload),
        content_type="application/json",
        status=200 if db_ok else 503,
    )
