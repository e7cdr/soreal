# tour_menu/extractor.py - Extract lead data from WhatsApp messages
import re
from typing import List, Dict, Any


def extract_phone_number(text: str) -> str:
    """Extract a phone number from message text or sender name."""
    # Common WhatsApp phone patterns
    patterns = [
        r'\+?\d{1,3}[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{4}',  # +1 234 567 8901
        r'\+?\d{1,3}[\s-]?\d{2}[\s-]?\d{3}[\s-]?\d{4}',  # +593 98 740 3113
        r'\b\d{3}[\s-]?\d{3}[\s-]?\d{4}\b',               # 234 567 8901
        r'\b\d{2}[\s-]?\d{3}[\s-]?\d{4}\b',               # 98 740 3113
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(0)
    return ''


def extract_bedrooms(text: str) -> int:
    """Extract number of bedrooms from message text."""
    patterns = [
        r'(\d+)\s*(?:bed|bedroom|bd|dormitorio|hab)',
        r'(\d+)\s*br\b',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            try:
                return int(match.group(1))
            except ValueError:
                pass
    return None


def extract_bathrooms(text: str) -> int:
    """Extract number of bathrooms from message text."""
    patterns = [
        r'(\d+)\s*(?:bath|bathroom|ba|baño|bano)',
        r'(\d+)\s*ba\b',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            try:
                return int(match.group(1))
            except ValueError:
                pass
    return None


def extract_price(text: str, currency: str = 'USD') -> float:
    """Extract price from message text."""
    patterns = [
        r'\$?\s*(\d[\d,]*(?:\.\d{1,2})?)\s*(?:usd|dollar|dólar)?',
        r'(\d[\d,]*(?:\.\d{1,2})?)\s*(?:usd|dollar|dólar)',
        r'USD\s*(\d[\d,]*(?:\.\d{1,2})?)',
        r'\$(\d[\d,]*(?:\.\d{1,2})?)',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            try:
                price_str = match.group(1).replace(',', '')
                return float(price_str)
            except ValueError:
                pass
    return None


def extract_property_type(text: str) -> str:
    """Extract property type from message text."""
    type_map = {
        'house': ['house', 'casa', 'homes', 'casas'],
        'apartment': ['apartment', 'apto', 'apartamento', 'apt', 'unit'],
        'villa': ['villa', 'villa', 'chalé'],
        'land': ['land', 'terreno', 'lot', 'lote'],
        'commercial': ['commercial', 'comercial', 'office', 'oficina'],
    }
    text_lower = text.lower()
    for ptype, keywords in type_map.items():
        if any(kw in text_lower for kw in keywords):
            return ptype
    return ''


def extract_city(text: str) -> str:
    """Extract city name from message text."""
    common_cities = [
        'santo domingo', 'santiago', 'punta cana', 'la romana', 'puerto plata',
        'bavaro', 'cap cana', 'juanillo', 'cabarete', 'las terrenas',
        'medellin', 'bogota', 'cali', 'barranquilla', 'cartagena',
        'mexico city', 'cancun', 'playa del carmen', 'tulum',
        'lima', 'cusco', 'arequipa', 'miami', 'orlando', 'new york',
        'madrid', 'barcelona', 'valencia', 'sevilla',
    ]
    text_lower = text.lower()
    for city in common_cities:
        if city in text_lower:
            return city.title()
    return ''


def extract_lead_data(message: Dict[str, Any]) -> Dict[str, Any]:
    """Extract structured lead data from a WhatsApp message record."""
    text = message.get('message', '')
    sender = message.get('sender', '')

    phone = extract_phone_number(text) or extract_phone_number(sender)
    bedrooms = extract_bedrooms(text)
    bathrooms = extract_bathrooms(text)
    price = extract_price(text)
    property_type = extract_property_type(text)
    city = extract_city(text)

    # Build a lead name from sender
    full_name = sender.strip() if sender else 'Unknown'

    return {
        'full_name': full_name,
        'phone': phone,
        'property_type': property_type,
        'min_bedrooms': bedrooms,
        'max_bedrooms': bedrooms,
        'min_price': price,
        'max_price': price,
        'city': city,
        'province': '',  # Could extract from context if needed
        'source_message': text[:500] if text else '',
        'source': 'whatsapp',
    }
