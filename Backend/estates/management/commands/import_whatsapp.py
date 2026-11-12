# Backend/estates/management/commands/import_whatsapp.py
from django.core.management.base import BaseCommand, CommandError
from django.db.models import Q
from django.conf import settings
import os

from estates.whatsapp_parser import (
    unzip_chat_export,
    parse_whatsapp_chat,
    associate_request_context,
    associate_followup_attachments,
    dedupe_messages,
    DEFAULT_LEAD_KEYWORDS,
    classify_lead_intent,
    filter_property_leads,
    extract_lead_data,
    normalize_whatsapp_sender,
)
from estates.matching import create_matches_for_lead
from estates.models import Lead
from estates.models import WhatsAppIgnoredUser

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
        all_messages = associate_request_context(
            parse_whatsapp_chat(txt_path, extract_dir, debug=debug)
        )
        self.stdout.write(f"Parsed {len(all_messages)} total messages.")

        # Step 3: Classify all messages
        upper_keywords = {k: [kw.upper() for kw in v] for v in DEFAULT_LEAD_KEYWORDS.items()}
        for msg in all_messages:
            msg['destination'] = classify_lead_intent(msg['message'], upper_keywords)

        # Step 4: Associate follow-up attachments
        all_messages = associate_followup_attachments(all_messages, debug=debug)

        # Step 5: Filter property leads
        day_first_dates = os.path.basename(txt_path).lower().startswith(
            "chat de whatsapp con "
        )
        lead_msgs, misc_msgs = filter_property_leads(
            all_messages,
            upper_keywords,
            recent_days,
            debug=debug,
            day_first=day_first_dates,
        )
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
        chat_name = os.path.splitext(os.path.basename(txt_path))[0]
        for prefix in ("Chat de WhatsApp con ", "WhatsApp Chat with "):
            if chat_name.startswith(prefix):
                chat_name = chat_name[len(prefix):]
                break

        ignored_sender_keys = set(
            WhatsAppIgnoredUser.objects.values_list("sender_key", flat=True)
        )

        for msg in unique_leads:
            source_sender = msg.get("sender", "").strip()
            sender_key = normalize_whatsapp_sender(source_sender)
            if sender_key and sender_key in ignored_sender_keys:
                skipped += 1
                continue

            lead_data = extract_lead_data(msg)

            # Check for duplicate by phone + name
            phone = lead_data.get('phone', '')
            name = lead_data.get('full_name', '')

            request_notes = (
                f"WhatsApp request:\n{lead_data.get('source_message', '')}"
            )
            duplicate_query = Lead.objects.filter(
                whatsapp_group=chat_name[:200],
                notes=request_notes,
            )
            if source_sender:
                duplicate_query = duplicate_query.filter(
                    Q(source_sender=source_sender)
                    | Q(source_sender="", name=name[:200])
                )
            elif phone:
                duplicate_query = duplicate_query.filter(phone=phone)
            else:
                duplicate_query = duplicate_query.filter(name=name[:200], phone="")
            if duplicate_query.exists():
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
                    name=lead_data['full_name'][:200],
                    phone=lead_data['phone'],
                    source_sender=source_sender[:200],
                    whatsapp_group=chat_name[:200],
                    source='whatsapp',
                    listing_type=lead_data.get('listing_type', 'any'),
                    property_type=lead_data.get('property_type', '') or None,
                    min_bedrooms=lead_data.get('min_bedrooms'),
                    max_bedrooms=lead_data.get('max_bedrooms'),
                    min_bathrooms=lead_data.get('min_bathrooms'),
                    max_bathrooms=lead_data.get('max_bathrooms'),
                    min_price=lead_data.get('min_price'),
                    max_price=lead_data.get('max_price'),
                    budget_currency=lead_data.get('budget_currency') or None,
                    preferred_location=lead_data.get('preferred_location') or None,
                    furnishing=lead_data.get('furnishing') or None,
                    city=lead_data.get('city', '') or None,
                    province=lead_data.get('province', '') or None,
                    notes=request_notes,
                    status='new',
                )

                # Auto-match against existing properties
                new_matches = create_matches_for_lead(lead)
                matches_created += len(new_matches)

                imported += 1
                if debug:
                    self.stdout.write(f"Created lead: {lead.name} ({lead.phone}) - {len(new_matches)} match(es)")

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
