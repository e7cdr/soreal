# Backend/estates/management/commands/scrape_estates.py
"""
Slow, polite real estate scraping command.

Philosophy: "Castle brick by brick" — scrape 2 estates per day max,
from different sites, never bulk. Respect robots.txt, identify the bot,
sequential requests, no login walls, no CAPTCHA bypass, no PII storage.

Scraped estates land as `draft` / `unverified` until an agent reviews them.
"""

import hashlib
import time
from datetime import date
from urllib.parse import urlparse

import requests
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from estates.models import Property

# Conservative user-agent that clearly identifies the bot.
USER_AGENT = "soreal-bot/1.0 (+https://soreal.example/bot)"

# Maximum number of estates to scrape per day (across all sites).
DAILY_SCRAPE_LIMIT = 2

# Sites configured for scraping. Each entry maps a site key to a scraper
# function name in this module and a base domain for robots.txt checking.
SCRAPE_SITES = [
    {
        "key": "example_com",
        "name": "Example.com",
        "domain": "example.com",
        "scraper": "scrape_example_com",
    },
]


def get_site_url():
    return getattr(settings, "SITE_URL", "http://localhost:8000").rstrip("/")


def check_robots_txt(domain):
    """Return True if the domain's robots.txt allows our user-agent to fetch /."""
    try:
        robots_url = f"https://{domain}/robots.txt"
        resp = requests.get(
            robots_url,
            headers={"User-Agent": USER_AGENT},
            timeout=10,
        )
        if resp.status_code != 200:
            # No robots.txt — conservative: allow.
            return True
        text = resp.text.lower()
        # Very naive check: if there's a blanket Disallow: / for our UA, block.
        if "user-agent: *" in text and "disallow: /" in text:
            return False
        return True
    except Exception:
        # If we can't check robots.txt, be conservative and skip.
        return False


def compute_source_hash(title, address, city, price):
    """Compute a stable hash to detect cross-site duplicates."""
    raw = f"{title}|{address or ''}|{city or ''}|{price or ''}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def upsert_scraped_estate(site_key, site_name, source_url, title, description,
                          price, currency, city, province, address,
                          bedrooms, bathrooms, property_type, listing_type,
                          debug=False, debug_print=None):
    """Create or update a scraped Property as draft/unverified."""
    source_hash = compute_source_hash(title, address, city, price)

    # Skip if we already have this exact listing from any source.
    existing = Property.objects.filter(source_hash=source_hash).first()
    if existing:
        if debug and debug_print:
            debug_print(f"  Skip duplicate (hash match): {title}")
        return False, "duplicate"

    property_type = property_type or "apartment"
    listing_type = listing_type or "sale"

    prop = Property.objects.create(
        title=title[:255],
        slug=f"scraped-{site_key}-{source_hash[:12]}",
        description=description or "",
        property_type=property_type,
        listing_type=listing_type,
        price=price,
        currency=currency or "USD",
        bedrooms=bedrooms,
        bathrooms=bathrooms,
        address=address or "",
        city=city or "",
        province=province or "",
        status="draft",
        source_site=site_name,
        source_url=source_url,
        source_imported_at=timezone.now(),
        source_verified=False,
        source_hash=source_hash,
        source_status="unverified",
        created_by="soreal-bot",
    )

    if debug and debug_print:
        debug_print(f"  Created draft: {prop.title} ({prop.custom_id})")
    return True, "created"


# ---------------------------------------------------------------------------
# Individual scrapers (one per site). Each returns a list of dicts with keys:
#   title, description, price, currency, city, province, address,
#   bedrooms, bathrooms, property_type, listing_type, source_url
# ---------------------------------------------------------------------------

def scrape_example_com(debug=False):
    """
    Example scraper stub. Replace with real site-specific logic.

    This site is configured as a placeholder. Add real scrapers by:
    1. Adding an entry to SCRAPE_SITES
    2. Writing a scrape_<key>() function here
    3. Ensuring robots.txt allows scraping
    """
    if debug:
        stdout_write_debug("  example_com: no real scraper implemented yet")
    return []


# Map site key -> scraper function.
SCRAPER_FUNCTIONS = {
    entry["key"]: globals()[entry["scraper"]]
    for entry in SCRAPE_SITES
    if entry["scraper"] in globals()
}


class Command(BaseCommand):
    help = (
        "Scrape up to 2 estates per day from different real estate sites. "
        "Results land as draft/unverified properties pending agent review."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--limit",
            type=int,
            default=DAILY_SCRAPE_LIMIT,
            help="Max estates to scrape this run (default: 2).",
        )
        parser.add_argument(
            "--sites",
            type=str,
            default="",
            help="Comma-separated site keys to scrape (default: all configured).",
        )
        parser.add_argument(
            "--debug",
            action="store_true",
            help="Enable debug output.",
        )

    def handle(self, *args, **options):
        limit = options["limit"]
        debug = options["debug"]
        requested_sites = [
            s.strip() for s in options["sites"].split(",") if s.strip()
        ] if options["sites"] else None

        stdout_write_debug = self.stdout.write if debug else lambda *a, **k: None

        # Count how many were already scraped today.
        today = date.today()
        already_scraped_today = Property.objects.filter(
            source_site__isnull=False,
            source_imported_at__date=today,
        ).count()

        remaining_today = max(0, DAILY_SCRAPE_LIMIT - already_scraped_today)
        effective_limit = min(limit, remaining_today)

        if effective_limit <= 0:
            self.stdout.write(
                self.style.WARNING(
                    f"Daily scrape limit ({DAILY_SCRAPE_LIMIT}) already reached today. "
                    f"No estates scraped."
                )
            )
            return

        self.stdout.write(
            f"Scrape budget today: {effective_limit} of {DAILY_SCRAPE_LIMIT} remaining."
        )

        # Select sites to scrape.
        sites_to_scrape = SCRAPE_SITES
        if requested_sites:
            sites_to_scrape = [
                s for s in SCRAPE_SITES if s["key"] in requested_sites
            ]

        imported = 0
        skipped = 0
        errors = []

        for site in sites_to_scrape:
            if imported >= effective_limit:
                break

            site_key = site["key"]
            site_name = site["name"]
            domain = site["domain"]

            self.stdout.write(f"\nChecking {site_name} ({domain})...")

            # Respect robots.txt.
            if not check_robots_txt(domain):
                self.stdout.write(
                    self.style.WARNING(
                        f"  Skipping {site_name}: robots.txt disallows scraping."
                    )
                )
                skipped += 1
                continue

            scraper_fn = SCRAPER_FUNCTIONS.get(site_key)
            if not scraper_fn:
                self.stdout.write(
                    self.style.WARNING(
                        f"  Skipping {site_name}: no scraper function implemented."
                    )
                )
                skipped += 1
                continue

            try:
                listings = scraper_fn(debug=debug)
            except Exception as exc:
                self.stdout.write(
                    self.style.ERROR(
                        f"  Scraper error for {site_name}: {exc}"
                    )
                )
                errors.append(f"{site_key}: {exc}")
                continue

            for listing in listings:
                if imported >= effective_limit:
                    break

                try:
                    created, reason = upsert_scraped_estate(
                        site_key=site_key,
                        site_name=site_name,
                        source_url=listing.get("source_url", ""),
                        title=listing.get("title", ""),
                        description=listing.get("description", ""),
                        price=listing.get("price"),
                        currency=listing.get("currency", "USD"),
                        city=listing.get("city", ""),
                        province=listing.get("province", ""),
                        address=listing.get("address", ""),
                        bedrooms=listing.get("bedrooms"),
                        bathrooms=listing.get("bathrooms"),
                        property_type=listing.get("property_type"),
                        listing_type=listing.get("listing_type", "sale"),
                        debug=debug,
                        debug_print=stdout_write_debug,
                    )
                    if created:
                        imported += 1
                    else:
                        skipped += 1
                except Exception as exc:
                    errors.append(f"{site_key}/{listing.get('title', 'unknown')}: {exc}")
                    if debug:
                        self.stdout.write(self.style.ERROR(f"  Error: {exc}"))

            # Be polite: delay between sites.
            if imported < effective_limit:
                time.sleep(2)

        # Summary
        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(
            f"Scrape complete: {imported} imported, {skipped} skipped."
        ))
        if errors:
            self.stdout.write(self.style.ERROR(f"Errors ({len(errors)}):"))
            for e in errors:
                self.stdout.write(self.style.ERROR(f"  - {e}"))
