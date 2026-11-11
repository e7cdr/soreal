# tour_menu/classifier.py - Adapted for soreal lead extraction
# Classifies WhatsApp messages as property-seeking leads instead of travel destinations
from typing import List, Dict, Any, Tuple
from datetime import datetime, timedelta
from collections import defaultdict
import re


# Default property-seeking keywords for classifying WhatsApp messages as leads
DEFAULT_LEAD_KEYWORDS = {
    'for_rent': [
        'RENT', 'RENTAL', 'FOR RENT', 'ALQUILER', 'APARTAMENTO RENTA', 'CASA RENTA',
        'LOOKING TO RENT', 'NEED TO RENT', 'WANT TO RENT', 'SE BUSCA RENTA',
        'APARTMENT FOR RENT', 'HOUSE FOR RENT', 'ROOM FOR RENT',
    ],
    'for_sale': [
        'FOR SALE', 'EN VENTA', 'BUY', 'PURCHASE', 'LOOKING TO BUY', 'WANT TO BUY',
        'SE BUSCA CASA', 'APARTMENT FOR SALE', 'HOUSE FOR SALE', 'PROPERTY FOR SALE',
        'LAND FOR SALE', 'VILLA FOR SALE',
    ],
    'property_inquiry': [
        'BEDROOMS', 'BATHROOMS', 'PRICE', 'PRICE RANGE', 'LOCATION', 'AREA', 'SQM',
        'M2', 'SQUARE METERS', 'NEIGHBORHOOD', 'BARRIO', 'SECTOR', 'CONDOS',
        'CONDOMINIUM', 'APARTMENT', 'HOUSE', 'VILLA', 'LAND', 'TERRENO',
        'HOW MUCH', 'CUANTO', 'CUÁNTO', 'DISPONIBLE', 'AVAILABLE',
    ],
    'real_estate': [
        'REAL ESTATE', 'INMOBILIARIA', 'AGENT', 'AGENTE', 'BROKER', 'PROPERTY',
        'PROPIEDAD', 'LISTING', 'EXCLUSIVE', 'EXCLUSIVA',
    ],
}


def classify_lead_intent(message: str, upper_keywords: Dict[str, List[str]]) -> str:
    """Classify a WhatsApp message as a property-seeking lead type."""
    if not message or not message.strip():
        return 'other'
    msg_upper = message.upper()
    for intent, keywords in upper_keywords.items():
        if any(kw in msg_upper for kw in keywords):
            return intent
    return 'other'


def parse_date(date_str: str) -> datetime:
    """Parse 'MM/DD/YY' to full datetime (assume current century for YY < 50)."""
    try:
        month, day, year = map(int, date_str.split('/'))
        if year < 50:
            year += 2000
        else:
            year += 1900
        return datetime(year, month, day)
    except ValueError:
        return datetime.min


def filter_property_leads(messages: List[Dict[str, Any]], upper_keywords: Dict[str, List[str]], recent_days: int, debug: bool = False) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Filter WhatsApp messages into property leads vs misc messages based on recent days."""
    today = datetime.now()
    cutoff = today - timedelta(days=recent_days)
    lead_msgs = []
    misc_msgs = []
    for msg in messages:
        msg_date = parse_date(msg['date'])
        if msg_date < cutoff:
            continue
        dest = classify_lead_intent(msg['message'], upper_keywords)
        if dest != 'other':
            msg_copy = msg.copy()
            msg_copy['destination'] = dest
            lead_msgs.append(msg_copy)
        elif msg['date'] >= cutoff.strftime('%m/%d/%y') and (msg['message'].strip() or msg['attachments']):
            msg_copy = msg.copy()
            msg_copy['destination'] = 'misc'
            misc_msgs.append(msg_copy)
    if debug:
        print(f"=== DEBUG: Filtered {len(lead_msgs)} lead msgs + {len(misc_msgs)} misc msgs (cutoff: {cutoff.strftime('%Y-%m-%d')}) ===")
    return lead_msgs, misc_msgs
