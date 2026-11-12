from django.db.models import Avg, Count, Max, Min, Sum, Q, F
from django.db.models.functions import TruncMonth, TruncWeek, TruncDay
from django.utils import timezone
from datetime import timedelta
from .models import (
    Property,
    PropertyInquiry,
    Lead,
    TenantApplication,
    Project,
    ProjectUnit,
)


def get_date_range(period="6m"):
    """Get start date based on period."""
    now = timezone.now()
    if period == "1m":
        return now - timedelta(days=30)
    elif period == "3m":
        return now - timedelta(days=90)
    elif period == "6m":
        return now - timedelta(days=180)
    elif period == "1y":
        return now - timedelta(days=365)
    return now - timedelta(days=180)


def get_price_trends(period="6m", city=None):
    """Get average, min, max prices over time."""
    start_date = get_date_range(period)
    queryset = Property.objects.filter(
        price__isnull=False,
        created_at__gte=start_date,
    )
    if city:
        queryset = queryset.filter(city__icontains=city)

    trends = (
        queryset.annotate(month=TruncMonth("created_at"))
        .values("month")
        .annotate(
            avg_price=Avg("price"),
            min_price=Min("price"),
            max_price=Max("price"),
            count=Count("id"),
        )
        .order_by("month")
    )

    return [
        {
            "date": t["month"].date().isoformat(),
            "avg_price": round(float(t["avg_price"]), 2),
            "min_price": round(float(t["min_price"]), 2),
            "max_price": round(float(t["max_price"]), 2),
            "count": t["count"],
        }
        for t in trends
    ]


def get_request_volume(period="6m"):
    """Get inquiry and lead volume over time."""
    start_date = get_date_range(period)

    inquiries = (
        PropertyInquiry.objects.filter(created_at__gte=start_date)
        .annotate(month=TruncMonth("created_at"))
        .values("month")
        .annotate(count=Count("id"))
        .order_by("month")
    )

    leads = (
        Lead.objects.filter(created_at__gte=start_date)
        .annotate(month=TruncMonth("created_at"))
        .values("month")
        .annotate(count=Count("id"))
        .order_by("month")
    )

    # Merge into single timeline
    data = {}
    for item in inquiries:
        key = item["month"].date().isoformat()
        data[key] = {"date": key, "inquiries": item["count"], "leads": 0}

    for item in leads:
        key = item["month"].date().isoformat()
        if key in data:
            data[key]["leads"] = item["count"]
        else:
            data[key] = {"date": key, "inquiries": 0, "leads": item["count"]}

    return sorted(data.values(), key=lambda x: x["date"])


def get_conversion_funnel():
    """Get conversion rate through the funnel."""
    total_inquiries = PropertyInquiry.objects.count()
    applications = TenantApplication.objects.count()
    approved = TenantApplication.objects.filter(decision="approved").count()
    rejected = TenantApplication.objects.filter(decision="rejected").count()

    stages = []

    if total_inquiries > 0:
        stages.append({
            "stage": "Inquiries",
            "count": total_inquiries,
            "conversion_rate": 100.0,
        })
        stages.append({
            "stage": "Applications",
            "count": applications,
            "conversion_rate": round((applications / total_inquiries) * 100, 2),
        })
        stages.append({
            "stage": "Approved",
            "count": approved,
            "conversion_rate": round((approved / total_inquiries) * 100, 2),
        })
        stages.append({
            "stage": "Rejected",
            "count": rejected,
            "conversion_rate": round((rejected / total_inquiries) * 100, 2),
        })
    else:
        stages = [
            {"stage": "Inquiries", "count": 0, "conversion_rate": 0.0},
            {"stage": "Applications", "count": 0, "conversion_rate": 0.0},
            {"stage": "Approved", "count": 0, "conversion_rate": 0.0},
            {"stage": "Rejected", "count": 0, "conversion_rate": 0.0},
        ]

    return stages


def get_category_stats():
    """Get statistics by property type."""
    queryset = (
        Property.objects.filter(price__isnull=False)
        .values("property_type")
        .annotate(
            count=Count("id"),
            avg_price=Avg("price"),
            total_value=Sum("price"),
        )
        .order_by("-count")
    )

    return [
        {
            "property_type": item["property_type"] or "Other",
            "count": item["count"],
            "avg_price": round(float(item["avg_price"]), 2) if item["avg_price"] else 0,
            "total_value": round(float(item["total_value"]), 2) if item["total_value"] else 0,
        }
        for item in queryset
    ]


def get_location_stats():
    """Get statistics by city/province."""
    queryset = (
        Property.objects.filter(price__isnull=False)
        .values("city", "province")
        .annotate(
            count=Count("id"),
            avg_price=Avg("price"),
        )
        .order_by("-count")[:20]
    )

    return [
        {
            "city": item["city"] or "Unknown",
            "province": item["province"] or "Unknown",
            "count": item["count"],
            "avg_price": round(float(item["avg_price"]), 2) if item["avg_price"] else 0,
        }
        for item in queryset
    ]


def get_unit_status_stats(project=None):
    """Get unit status breakdown for a project or all projects."""
    queryset = ProjectUnit.objects.all()
    if project:
        queryset = queryset.filter(project=project)

    status_counts = (
        queryset.values("status")
        .annotate(count=Count("id"))
        .order_by("status")
    )

    total = sum(item["count"] for item in status_counts)

    return {
        "total_units": total,
        "by_status": [
            {
                "status": item["status"],
                "count": item["count"],
                "percentage": round((item["count"] / total * 100), 2) if total > 0 else 0,
            }
            for item in status_counts
        ],
    }


def get_dashboard_summary():
    """Get high-level dashboard summary numbers."""
    return {
        "total_properties": Property.objects.count(),
        "available_properties": Property.objects.filter(
            status__in=["available", "reserved"]
        ).count(),
        "total_inquiries": PropertyInquiry.objects.count(),
        "total_leads": Lead.objects.count(),
        "total_applications": TenantApplication.objects.count(),
        "approved_applications": TenantApplication.objects.filter(
            decision="approved"
        ).count(),
        "total_projects": Project.objects.count(),
        "total_units": ProjectUnit.objects.count(),
        "available_units": ProjectUnit.objects.filter(status="available").count(),
        "sold_units": ProjectUnit.objects.filter(status__in=["sold", "rented"]).count(),
    }
