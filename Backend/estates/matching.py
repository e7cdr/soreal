from django.db.models import Q
from .models import Lead, LeadMatch, Property


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

    # Price match (15 points)
    if lead.min_price or lead.max_price:
        min_price = lead.min_price or 0
        max_price = lead.max_price or 999999999
        if property.price and min_price <= property.price <= max_price:
            score += 15
            reasons.append("price")
        elif property.price:
            # Close match (within 20%)
            if property.price <= max_price * 1.2 or property.price >= min_price * 0.8:
                score += 5
                reasons.append("price (close)")
    elif property.price:
        score += 5  # Lead didn't specify price
        reasons.append("any price")

    # Location match (10 points)
    if lead.city and lead.city.lower() == property.city.lower():
        score += 10
        reasons.append("city")
    elif lead.province and lead.province.lower() == property.province.lower():
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
