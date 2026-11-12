from django.db import models
from django.db.models import Q
from .models import Lead, LeadLeadMatch, LeadMatch, Property


def compute_match_score(lead, property):
    """
    Compute a match score (0-100) between a lead and a property.
    Returns (score, reasons_list).
    """
    score = 0
    reasons = []

    # Listing type match (30 points)
    if lead.listing_type == "any" or lead.listing_type == property.listing_type:
        score += 30
        reasons.append("listing type")
    else:
        return 0, []  # No match if listing type doesn't align

    # Property type match (20 points)
    if lead.property_type and lead.property_type.lower() == property.property_type.lower():
        score += 20
        reasons.append("property type")
    elif not lead.property_type:
        score += 10  # Partial credit if lead didn't specify
        reasons.append("any property type")

    # Bedrooms match (25 points)
    if lead.min_bedrooms or lead.max_bedrooms:
        min_bed = lead.min_bedrooms or 0
        max_bed = lead.max_bedrooms or 999
        if property.bedrooms and min_bed <= property.bedrooms <= max_bed:
            score += 25
            reasons.append("bedrooms")
        elif property.bedrooms:
            # Close match (within 1 bedroom)
            if abs(property.bedrooms - min_bed) <= 1 or abs(property.bedrooms - max_bed) <= 1:
                score += 10
                reasons.append("bedrooms (close)")
    elif property.bedrooms:
        score += 10  # Lead didn't specify, property has bedrooms
        reasons.append("any bedrooms")

    # Price match (15 points). Do not compare unlike currencies.
    if lead.min_price or lead.max_price:
        min_price = lead.min_price or 0
        max_price = lead.max_price or 999999999
        currency_matches = (
            not lead.budget_currency
            or lead.budget_currency.upper() == property.currency.upper()
        )
        if (
            currency_matches
            and property.price
            and min_price <= property.price <= max_price
        ):
            score += 15
            reasons.append("price")
        elif currency_matches and property.price:
            # Close match (within 20%)
            if property.price <= max_price * 1.2 or property.price >= min_price * 0.8:
                score += 5
                reasons.append("price (close)")
    elif property.price:
        score += 5  # Lead didn't specify price
        reasons.append("any price")

    # Location match (10 points)
    preferred_locations = [
        location.strip().lower()
        for location in (lead.preferred_location or "").split(",")
        if location.strip()
    ]
    property_location = " ".join(
        filter(
            None,
            [
                property.city,
                property.address,
                property.title,
                str(property.description or ""),
            ],
        )
    ).lower()
    if any(location in property_location for location in preferred_locations):
        score += 10
        reasons.append("preferred location")
    elif lead.city and lead.city.lower() == (property.city or "").lower():
        score += 10
        reasons.append("city")
    elif lead.province and lead.province.lower() == (property.province or "").lower():
        score += 5
        reasons.append("province")

    return min(score, 100), reasons


def find_matches_for_lead(lead, min_score=30):
    """Find properties that match a lead."""
    queryset = Property.objects.filter(status__in=["available", "reserved"])
    matches = []

    for prop in queryset:
        score, reasons = compute_match_score(lead, prop)
        if score >= min_score:
            matches.append((prop, score, ", ".join(reasons)))

    return matches


def find_matches_for_property(property, min_score=30):
    """Find leads that match a property."""
    queryset = Lead.objects.filter(status="new")
    matches = []

    for lead in queryset:
        score, reasons = compute_match_score(lead, property)
        if score >= min_score:
            matches.append((lead, score, ", ".join(reasons)))

    return matches


def create_matches_for_lead(lead):
    """Create LeadMatch records for a new lead."""
    matches = find_matches_for_lead(lead)
    created = []

    for prop, score, reasons in matches:
        match, created_flag = LeadMatch.objects.get_or_create(
            lead=lead,
            property=prop,
            defaults={
                "match_score": score,
                "match_reasons": reasons,
                "status": "pending",
            },
        )
        if created_flag:
            created.append(match)

    return created


def create_matches_for_property(property):
    """Create LeadMatch records for a new property."""
    matches = find_matches_for_property(property)
    created = []

    for lead, score, reasons in matches:
        match, created_flag = LeadMatch.objects.get_or_create(
            lead=lead,
            property=property,
            defaults={
                "match_score": score,
                "match_reasons": reasons,
                "status": "pending",
            },
        )
        if created_flag:
            created.append(match)

    return created


def compute_lead_lead_score(lead_a, lead_b):
    """
    Compute a match score (0-100) between two leads.
    Returns (score, reasons_list).
    """
    score = 0
    reasons = []

    # Listing type match (20 points)
    if lead_a.listing_type == "any" or lead_b.listing_type == "any":
        score += 20
        reasons.append("listing type")
    elif lead_a.listing_type == lead_b.listing_type:
        score += 20
        reasons.append("listing type")

    # Property type match (20 points)
    if lead_a.property_type and lead_b.property_type:
        if lead_a.property_type.lower() == lead_b.property_type.lower():
            score += 20
            reasons.append("property type")
    elif not lead_a.property_type or not lead_b.property_type:
        score += 10
        reasons.append("any property type")

    # Bedrooms overlap (25 points)
    a_min = lead_a.min_bedrooms or 0
    a_max = lead_a.max_bedrooms or 999
    b_min = lead_b.min_bedrooms or 0
    b_max = lead_b.max_bedrooms or 999
    if max(a_min, b_min) <= min(a_max, b_max):
        score += 25
        reasons.append("bedrooms")
    elif abs(a_min - b_min) <= 1 or abs(a_max - b_max) <= 1:
        score += 10
        reasons.append("bedrooms (close)")

    # Price overlap (20 points) - same currency only
    a_min_p = lead_a.min_price or 0
    a_max_p = lead_a.max_price or 999999999
    b_min_p = lead_b.min_price or 0
    b_max_p = lead_b.max_price or 999999999
    same_currency = (
        not lead_a.budget_currency
        or not lead_b.budget_currency
        or lead_a.budget_currency.upper() == lead_b.budget_currency.upper()
    )
    if same_currency and max(a_min_p, b_min_p) <= min(a_max_p, b_max_p):
        score += 20
        reasons.append("price")
    elif same_currency:
        # Close match (within 20%)
        a_mid = (a_min_p + a_max_p) / 2 if a_max_p < 999999999 else a_min_p
        b_mid = (b_min_p + b_max_p) / 2 if b_max_p < 999999999 else b_min_p
        if a_mid and b_mid and abs(a_mid - b_mid) <= max(a_mid, b_mid) * 0.2:
            score += 10
            reasons.append("price (close)")

    # Location match (15 points)
    a_locations = [
        loc.strip().lower()
        for loc in (lead_a.preferred_location or "").split(",")
        if loc.strip()
    ]
    b_locations = [
        loc.strip().lower()
        for loc in (lead_b.preferred_location or "").split(",")
        if loc.strip()
    ]
    a_city = (lead_a.city or "").strip().lower()
    b_city = (lead_b.city or "").strip().lower()
    a_province = (lead_a.province or "").strip().lower()
    b_province = (lead_b.province or "").strip().lower()

    if a_city and b_city and a_city == b_city:
        score += 15
        reasons.append("city")
    elif a_province and b_province and a_province == b_province:
        score += 10
        reasons.append("province")
    elif a_locations and b_locations:
        overlap = set(a_locations) & set(b_locations)
        if overlap:
            score += 10
            reasons.append("preferred location")

    return min(score, 100), reasons


def find_matching_leads(lead, min_score=30):
    """Find other leads that match this lead."""
    queryset = Lead.objects.exclude(id=lead.id).filter(status="new")
    matches = []

    for other in queryset:
        score, reasons = compute_lead_lead_score(lead, other)
        if score >= min_score:
            matches.append((other, score, ", ".join(reasons)))

    return matches


def create_matches_for_lead_lead(lead):
    """Create LeadLeadMatch records for a new or updated lead."""
    # Remove any existing pending matches for this lead so they get recalculated
    LeadLeadMatch.objects.filter(
        Q(lead_a=lead) | Q(lead_b=lead), status="pending"
    ).delete()

    matches = find_matching_leads(lead)
    created = []

    for other, score, reasons in matches:
        # Ensure lead_a has the lower id to avoid duplicates
        first, second = (lead, other) if lead.id < other.id else (other, lead)
        match, created_flag = LeadLeadMatch.objects.get_or_create(
            lead_a=first,
            lead_b=second,
            defaults={
                "match_score": score,
                "match_reasons": reasons,
                "status": "pending",
            },
        )
        if created_flag:
            created.append(match)

    return created
