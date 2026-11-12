import re
import unicodedata
from typing import Any, Dict, List, Optional, Tuple


PHONE_PATTERN = re.compile(
    r"(?<!\w)(?:\+\s*\d{1,3}[\s().-]*)?"
    r"(?:\(\d{2,4}\)|\d{2,4})[\s.-]+\d{2,4}[\s.-]+\d{3,4}(?!\w)"
)
COMPACT_PHONE_PATTERN = re.compile(r"(?<!\d)(?:\+?1)?\d{10}(?!\d)")
REQUEST_PATTERNS = (
    r"\b(?:busco|buscamos|estoy buscando|and[o]? buscando|necesito|necesitamos|"
    r"se busca|se necesita|quiero alquilar|quiero comprar)\b",
    r"\b(?:looking for|looking to (?:rent|buy)|need(?:ing)?|"
    r"want to (?:rent|buy)|seeking)\b",
    r"\b(?:quien|quién) (?:tiene|conoce|sabe)\b",
    r"\b(?:que|qué) tenemos en\b",
    r"\b(?:tienen|hay) (?:disponible|alg[uú]n|alguna)\b",
)
LISTING_PATTERNS = (
    r"\b(?:se vende|vendo|se renta|se alquila|rento|alquilo)\b",
    r"\b(?:sale listing|tenemos disponible|disponible para rentar)\b",
)
BEDROOM_PATTERN = re.compile(
    r"\b(\d+)\s*(?:bed(?:room)?s?|bd|br|habitaci[oó]n(?:es)?|"
    r"dormitorio(?:s)?|hab\.?)\b",
    re.IGNORECASE,
)
BATHROOM_PATTERN = re.compile(
    r"\b(\d+)\s*(?:bath(?:room)?s?|ba(?:ñ|n)o(?:s)?|ba\.?)\b",
    re.IGNORECASE,
)
NUMBER_PATTERN = r"(?:\d{1,3}(?:[,. ]\d{3})+|\d+(?:[,.]\d{1,2})?)"
MONEY_PREFIX_PATTERN = re.compile(
    rf"(?P<currency>US\s*\$|USD|RD\s*\$|RD\$|DOP|[$])\s*"
    rf"(?P<amount>{NUMBER_PATTERN})",
    re.IGNORECASE,
)
MONEY_SUFFIX_PATTERN = re.compile(
    rf"(?P<amount>{NUMBER_PATTERN})\s*"
    r"(?P<currency>USD|DOP|d[oó]lares?|pesos?)\b",
    re.IGNORECASE,
)
BUDGET_CUE_PATTERN = re.compile(
    r"\b(?:presupuesto|budget|hasta|m[aá]ximo|max(?:imum)?|tope|"
    r"no m[aá]s de|entre|rango)\b",
    re.IGNORECASE,
)
LOCATION_PATTERN = re.compile(
    r"\b(?:en|por|cerca de|alrededor de|near|around)\s+"
    r"([a-záéíóúñ][a-záéíóúñ0-9]*(?:[\s-]+[a-záéíóúñ0-9]+){0,3})",
    re.IGNORECASE,
)
LOCATION_ALIASES = (
    "costa cana",
    "punta cana",
    "pueblo bavaro",
    "pueblo bávaro",
    "ciudad las cayenas",
    "serena village",
    "primaveral",
    "brisas",
    "crisfer",
    "bavaro",
    "bávaro",
    "los corales",
    "downtown",
    "cap cana",
    "veron",
    "verón",
)


def _normalize_phone(candidate: str) -> str:
    digits = re.sub(r"\D", "", candidate)
    if candidate.strip().startswith("+"):
        return f"+{digits}"
    if len(digits) == 10:
        return f"+1{digits}"
    if len(digits) == 11 and digits.startswith("1"):
        return f"+{digits}"
    return digits


def extract_phone_number(text: str) -> str:
    """Extract and normalize the first formatted phone number in the text."""
    for pattern in (PHONE_PATTERN, COMPACT_PHONE_PATTERN):
        match = pattern.search(text or "")
        if match:
            return _normalize_phone(match.group(0))
    return ""


def normalize_whatsapp_sender(sender: str) -> str:
    """Build a stable key for ignoring a sender across chat exports."""
    sender = (sender or "").strip()
    phone = extract_phone_number(sender)
    if phone:
        digits = re.sub(r"\D", "", phone)
        return f"phone:{digits}"

    normalized = unicodedata.normalize("NFKD", sender.casefold())
    normalized = "".join(char for char in normalized if not unicodedata.combining(char))
    normalized = re.sub(r"[^a-z0-9]+", " ", normalized).strip()
    return f"name:{normalized}" if normalized else ""


def _parse_amount(amount: str) -> Optional[float]:
    cleaned = re.sub(r"\s", "", amount)
    if "," in cleaned and "." in cleaned:
        decimal_separator = "," if cleaned.rfind(",") > cleaned.rfind(".") else "."
        grouping_separator = "." if decimal_separator == "," else ","
        cleaned = cleaned.replace(grouping_separator, "")
        cleaned = cleaned.replace(decimal_separator, ".")
    elif "," in cleaned or "." in cleaned:
        separator = "," if "," in cleaned else "."
        tail = cleaned.rsplit(separator, 1)[-1]
        if len(tail) == 3:
            cleaned = cleaned.replace(separator, "")
        else:
            cleaned = cleaned.replace(separator, ".")
    try:
        return float(cleaned)
    except ValueError:
        return None


def _normalize_currency(currency: str) -> str:
    normalized = currency.upper().replace(" ", "")
    if normalized in {"RD$", "DOP", "PESO", "PESOS"}:
        return "DOP"
    if normalized in {"US$", "USD", "DOLAR", "DOLARES", "DÓLAR", "DÓLARES"}:
        return "USD"
    return ""


def extract_price_range(text: str) -> Tuple[Optional[float], Optional[float], str]:
    """Extract explicit or budget-qualified prices without mistaking room counts for money."""
    text = text or ""
    candidates: List[Tuple[int, float, str]] = []

    for pattern in (MONEY_PREFIX_PATTERN, MONEY_SUFFIX_PATTERN):
        for match in pattern.finditer(text):
            amount = _parse_amount(match.group("amount"))
            if amount is not None:
                candidates.append(
                    (match.start(), amount, _normalize_currency(match.group("currency")))
                )

    for cue in BUDGET_CUE_PATTERN.finditer(text):
        tail = text[cue.end():cue.end() + 50]
        match = re.match(
            rf"\s*(?:de|es|:)?\s*(US\s*\$|USD|RD\s*\$|RD\$|DOP|[$])?\s*"
            rf"(?P<amount>{NUMBER_PATTERN})",
            tail,
            re.IGNORECASE,
        )
        if match:
            amount = _parse_amount(match.group("amount"))
            position = cue.end() + match.start("amount")
            currency = _normalize_currency(match.group(1) or "")
            if amount is not None and not any(
                start == position for start, _, _ in candidates
            ):
                suffix = tail[match.end():match.end() + 16]
                currency_match = re.match(
                    r"\s*(USD|DOP|d[oó]lares?|pesos?)\b", suffix, re.IGNORECASE
                )
                if currency_match:
                    currency = _normalize_currency(currency_match.group(1))
                candidates.append((position, amount, currency))

            range_match = re.match(
                rf"\s*(?:a|y|hasta|-)\s*(?P<amount>{NUMBER_PATTERN})",
                tail[match.end():],
                re.IGNORECASE,
            )
            if range_match:
                upper_amount = _parse_amount(range_match.group("amount"))
                if upper_amount is not None:
                    candidates.append(
                        (
                            cue.end() + match.end() + range_match.start("amount"),
                            upper_amount,
                            currency,
                        )
                    )

    if not candidates:
        return None, None, ""

    candidates.sort()
    values = [value for _, value, _ in candidates]
    currencies = {currency for _, _, currency in candidates if currency}
    currency = currencies.pop() if len(currencies) == 1 else ""
    return min(values), max(values), currency


def extract_bedrooms(text: str) -> Optional[int]:
    match = BEDROOM_PATTERN.search(text or "")
    return int(match.group(1)) if match else None


def extract_bedroom_range(text: str) -> Tuple[Optional[int], Optional[int]]:
    range_match = re.search(
        r"\b(\d+)\s*(?:-|a|y|to)\s*(\d+)\s*"
        r"(?:bed(?:room)?s?|br|habitaci[oó]n(?:es)?|dormitorio(?:s)?)\b",
        text or "",
        re.IGNORECASE,
    )
    if range_match:
        first, second = int(range_match.group(1)), int(range_match.group(2))
        return min(first, second), max(first, second)
    bedrooms = extract_bedrooms(text)
    return bedrooms, bedrooms


def extract_bathrooms(text: str) -> Optional[int]:
    match = BATHROOM_PATTERN.search(text or "")
    return int(match.group(1)) if match else None


def extract_property_type(text: str) -> str:
    """Return a property type only when the request names one explicitly."""
    text_lower = (text or "").lower()
    type_map = {
        "house": ("house", "casa", "casas"),
        "apartment": ("apartment", "apto", "apartamento", "apartamentos", "apt"),
        "villa": ("villa", "villas"),
        "land": ("land", "terreno", "solar", "lote"),
        "commercial": ("commercial", "comercial", "office", "oficina", "nave"),
    }
    for property_type, terms in type_map.items():
        if any(re.search(rf"\b{re.escape(term)}\b", text_lower) for term in terms):
            return property_type
    return ""


def extract_location(text: str) -> str:
    """Extract a named neighborhood or community requested in the message."""
    text_lower = (text or "").lower()
    locations = []
    for location in LOCATION_ALIASES:
        if re.search(rf"\b{re.escape(location)}\b", text_lower):
            locations.append(location.title())
    if locations:
        return ", ".join(dict.fromkeys(locations))

    match = LOCATION_PATTERN.search(text or "")
    if match:
        return match.group(1).strip(" .,!?:;").title()
    return ""


def extract_furnishing(text: str) -> str:
    text_lower = (text or "").lower()
    furnished = bool(re.search(r"\b(?:amueblad[oa]s?|furnished)\b", text_lower))
    unfurnished = bool(
        re.search(r"\b(?:vac[ií]os?|sin muebles|unfurnished)\b", text_lower)
    )
    if furnished == unfurnished:
        return ""
    return "furnished" if furnished else "unfurnished"


def is_property_request(text: str) -> bool:
    """Reject property advertisements unless their wording explicitly asks for a home."""
    normalized = (text or "").lower()
    if not normalized.strip():
        return False
    is_request = any(re.search(pattern, normalized) for pattern in REQUEST_PATTERNS)
    is_listing = any(re.search(pattern, normalized) for pattern in LISTING_PATTERNS)
    return is_request and not is_listing


def extract_lead_data(message: Dict[str, Any]) -> Dict[str, Any]:
    """Extract a requester contact and specific requirements from a chat message."""
    text = message.get("message", "") or ""
    sender = message.get("sender", "") or ""
    phone = extract_phone_number(sender) or extract_phone_number(text)
    min_bedrooms, max_bedrooms = extract_bedroom_range(text)
    bathrooms = extract_bathrooms(text)
    min_price, max_price, budget_currency = extract_price_range(text)
    property_type = extract_property_type(text)
    preferred_location = extract_location(text)
    furnishing = extract_furnishing(text)

    request = text.strip()
    listing_type = "any"
    if re.search(
        r"\b(?:rent|rental|renting|alquiler|alquilar|rentar|renta)\b",
        request,
        re.IGNORECASE,
    ):
        listing_type = "rent"
    elif re.search(
        r"\b(?:buy|buying|purchase|comprar|compra|venta|vender)\b",
        request,
        re.IGNORECASE,
    ):
        listing_type = "sale"

    sender_name = sender.strip()
    if phone and _normalize_phone(sender_name) == phone:
        sender_name = phone

    return {
        "full_name": sender_name or "Unknown",
        "phone": phone,
        "listing_type": listing_type,
        "property_type": property_type,
        "min_bedrooms": min_bedrooms,
        "max_bedrooms": max_bedrooms,
        "min_bathrooms": bathrooms,
        "max_bathrooms": bathrooms,
        "min_price": min_price,
        "max_price": max_price,
        "budget_currency": budget_currency,
        "preferred_location": preferred_location,
        "furnishing": furnishing,
        "city": "",
        "province": "",
        "source_message": request,
        "source": "whatsapp",
    }
