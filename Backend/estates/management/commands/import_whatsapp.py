# Backend/estates/management/commands/import_whatsapp.py
from django.core.management.base import BaseCommand, CommandError
from django.conf import settings
import os

from estates.whatsapp_parser import (
    unzip_chat_export,
    parse_whatsapp_chat,
    associate_followup_attachments,
    dedupe_messages,
    classify_lead_intent,
    filter_property_leads,
    extract_lead_data,
)
from estates.matching import create_matches_for_lead
from estates.models import Lead

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


class Command(BaseCommand):
    help = "Import leads from a WhatsApp chat export ZIP file."

    def add_arguments(self, parser):
        parser.add_argument(
            "--zip-path",
            type=str,
            required=True,
            help="Path to the WhatsApp chat export ZIP file.",
        )
        parser.add_argument(
            "--output-dir",
            type=str,
            default=".",
            help="Directory for extracted files and media (default: current directory).",
        )
        parser.add_argument(
            "--recent-days",
            type=int,
            default=30,
            help="Number of recent days to include (default: 30).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Parse and report what would be imported without saving.",
        )
        parser.add_argument(
            "--debug",
            action="store_true",
            help="Enable debug output.",
        )

    def handle(self, *args, **options):
        zip_path = options["zip_path"]
        output_dir = options["output_dir"]
        recent_days = options["recent_days"]
        dry_run = options["dry_run"]
        debug = options["debug"]

        if not os.path.exists(zip_path):
            raise CommandError(f"ZIP file not found: {zip_path}")

        # Step 1: Extract ZIP
        txt_path, extract_dir = unzip_chat_export(zip_path, output_dir, debug=debug)
        self.stdout.write(f"Extracted chat export: {txt_path}")

        # Step 2: Parse messages
        all_messages = parse_whatsapp_chat(txt_path, extract_dir, debug=debug)
        self.stdout.write(f"Parsed {len(all_messages)} total messages.")

        # Step 3: Classify all messages
        upper_keywords = {k: [kw.upper() for kw in v] for v in DEFAULT_LEAD_KEYWORDS.items()}
        for msg in all_messages:
            msg['destination'] = classify_lead_intent(msg['message'], upper_keywords)

        # Step 4: Associate follow-up attachments
        all_messages = associate_followup_attachments(all_messages, debug=debug)

        # Step 5: Filter property leads
        lead_msgs, misc_msgs = filter_property_leads(all_messages, upper_keywords, recent_days, debug=debug)
        self.stdout.write(f"Found {len(lead_msgs)} property leads (last {recent_days} days).")

        # Step 6: Deduplicate
        unique_leads = dedupe_messages(lead_msgs)
        unique_misc = dedupe_messages(misc_msgs)
        self.stdout.write(f"After dedup: {len(unique_leads)} unique leads.")

        # Step 7: Extract lead data and create records
        imported = 0
        skipped = 0
        matches_created = 0
        errors = []

        for msg in unique_leads:
            lead_data = extract_lead_data(msg)

            # Check for duplicate by phone + name
            phone = lead_data.get('phone', '')
            name = lead_data.get('full_name', '')

            if Lead.objects.filter(phone=phone).exists():
                skipped += 1
                if debug:
                    self.stdout.write(f"Skipped duplicate: {name} ({phone})")
                continue

            if dry_run:
                self.stdout.write(f"[DRY-RUN] Would create lead: {name} ({phone}) - {lead_data.get('city', '')} - {lead_data.get('property_type', '')}")
                imported += 1
                continue

            try:
                lead = Lead.objects.create(
                    full_name=lead_data['full_name'],
                    phone=lead_data['phone'],
                    whatsapp_group=msg.get('whatsapp_group', ''),
                    source='whatsapp',
                    listing_type='any',
                    property_type=lead_data.get('property_type', '') or None,
                    min_bedrooms=lead_data.get('min_bedrooms'),
                    max_bedrooms=lead_data.get('max_bedrooms'),
                    min_price=lead_data.get('min_price'),
                    max_price=lead_data.get('max_price'),
                    city=lead_data.get('city', '') or None,
                    province=lead_data.get('province', '') or None,
                    notes=f"WhatsApp message: {lead_data.get('source_message', '')}",
                    status='new',
                )

                # Auto-match against existing properties
                new_matches = create_matches_for_lead(lead)
                matches_created += len(new_matches)

                imported += 1
                if debug:
                    self.stdout.write(f"Created lead: {lead.full_name} ({lead.phone}) - {len(new_matches)} match(es)")

            except Exception as e:
                errors.append(f"Failed to create lead for {name}: {str(e)}")
                if debug:
                    self.stdout.write(self.style.ERROR(f"Error: {e}"))

        # Summary
        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(
            f"Import complete: {imported} imported, {skipped} skipped, {matches_created} matches created."
        ))
        if errors:
            self.stdout.write(self.style.ERROR(f"Errors ({len(errors)}):"))
            for e in errors:
                self.stdout.write(self.style.ERROR(f"  - {e}"))
