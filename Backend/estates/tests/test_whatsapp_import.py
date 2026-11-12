import io
import tempfile
import zipfile
from datetime import date
from pathlib import Path
from types import SimpleNamespace

from django.core.files.uploadedfile import SimpleUploadedFile
from openpyxl import load_workbook
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from estates.matching import compute_match_score
from estates.models import (
    Broker,
    Lead,
    Owner,
    Property,
    Project,
    ScanInboxItem,
    WhatsAppIgnoredUser,
)
from estates.whatsapp_parser import (
    DEFAULT_LEAD_KEYWORDS,
    associate_request_context,
    associate_followup_attachments,
    classify_lead_intent,
    dedupe_messages,
    extract_lead_data,
    filter_property_leads,
    parse_whatsapp_chat,
    normalize_whatsapp_sender,
    unzip_chat_export,
)
from estates.whatsapp_parser.classifier import parse_date


def build_chat_zip(include_media=True, messages=None):
    buffer = io.BytesIO()
    message_date = date.today().strftime("%m/%d/%y")
    chat = messages or (
        f"{message_date}, 9:15 PM - +1 234 567 8901: "
        "Looking to rent a 2 bedroom apartment in Punta Cana"
    )
    if include_media:
        chat += " image.jpg (file attached)"

    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("WhatsApp/Chat.txt", chat)
        if include_media:
            archive.writestr("WhatsApp/media/image.jpg", b"sample image")
    return buffer.getvalue()


class WhatsAppParserTests(TestCase):
    def test_extracts_nested_chat_with_media(self):
        with tempfile.TemporaryDirectory() as output_dir:
            zip_path = Path(output_dir) / "chat.zip"
            zip_path.write_bytes(build_chat_zip())

            txt_path, extract_dir = unzip_chat_export(str(zip_path), output_dir)
            messages = parse_whatsapp_chat(txt_path, extract_dir)

            self.assertEqual(len(messages), 1)
            self.assertEqual(messages[0]["attachments"], ["image.jpg"])
            self.assertTrue((Path(extract_dir) / "WhatsApp" / "media" / "image.jpg").is_file())

    def test_parses_spanish_timestamp_and_associates_followup_media(self):
        with tempfile.TemporaryDirectory() as output_dir:
            txt_path = Path(output_dir) / "chat.txt"
            txt_path.write_text(
                "[21/08/26, 9:27 p. m.] Ana: Busco alquiler\n"
                "[21/08/26, 9:29 p. m.] Ana: image.jpg (file attached)\n",
                encoding="utf-8",
            )

            messages = parse_whatsapp_chat(str(txt_path), output_dir)
            associated = associate_followup_attachments(messages)

            self.assertEqual(associated[0]["attachments"], ["image.jpg"])
            self.assertEqual(len(associated), 1)

    def test_recent_days_filter_keeps_recent_misc_messages(self):
        messages = [{
            "date": date.today().strftime("%m/%d/%y"),
            "message": "Hello",
            "attachments": [],
        }]

        leads, misc = filter_property_leads(messages, {}, recent_days=30)

        self.assertEqual(leads, [])
        self.assertEqual(len(misc), 1)
        self.assertEqual(misc[0]["destination"], "misc")

    def test_spanish_date_order_and_local_lead_terms(self):
        parsed_date = parse_date("10/11/2026", day_first=True)
        keywords = {
            category: [term.upper() for term in terms]
            for category, terms in DEFAULT_LEAD_KEYWORDS.items()
        }
        intent = classify_lead_intent(
            "BUSCO EN PRIMAVERAL 3 HABITACIONES", keywords
        )

        self.assertEqual(parsed_date.date().isoformat(), "2026-11-10")
        self.assertEqual(intent, "property_inquiry")

    def test_request_extraction_normalizes_phone_and_structures_requirements(self):
        message = {
            "sender": "+1 (809) 776-7871",
            "message": (
                "Busco un apartamento de 3 habitaciones, 2 baños en Costa Cana, Brisas "
                "presupuesto US$1,200, amueblado"
            ),
        }

        lead = extract_lead_data(message)

        self.assertEqual(lead["phone"], "+18097767871")
        self.assertEqual(lead["listing_type"], "any")
        self.assertEqual(lead["property_type"], "apartment")
        self.assertEqual(lead["min_bedrooms"], 3)
        self.assertEqual(lead["min_bathrooms"], 2)
        self.assertEqual((lead["min_price"], lead["max_price"]), (1200, 1200))
        self.assertEqual(lead["budget_currency"], "USD")
        self.assertEqual(lead["preferred_location"], "Costa Cana, Brisas")
        self.assertEqual(lead["furnishing"], "furnished")
        self.assertEqual(lead["source_message"], message["message"])

    def test_sender_identity_is_normalized_without_using_message_text(self):
        self.assertEqual(
            normalize_whatsapp_sender("+1 (809) 776-7871"),
            normalize_whatsapp_sender("809 776 7871"),
        )
        self.assertEqual(
            normalize_whatsapp_sender("Yafreisis | Bienes Raíces."),
            "name:yafreisis bienes raices",
        )

    def test_request_context_includes_nearby_link_and_furnishing_answer(self):
        with tempfile.TemporaryDirectory() as output_dir:
            txt_path = Path(output_dir) / "chat.txt"
            txt_path.write_text(
                "11/10/26, 8:51 PM - +1 (849) 434-5924: "
                "Busco en Primaveral 3 habitaciones presupuesto 1300\n"
                "11/10/26, 8:52 PM - +1 (809) 776-7871: Vacío o amueblado?\n"
                "11/10/26, 8:53 PM - +1 (849) 434-5924: Vacío.\n",
                encoding="utf-8",
            )

            messages = associate_request_context(
                parse_whatsapp_chat(str(txt_path), output_dir)
            )
            request = next(message for message in messages if "Busco" in message["message"])
            lead = extract_lead_data(request)

        self.assertEqual(len(messages), 2)
        self.assertIn("Vacío.", request["message"])
        self.assertEqual(lead["phone"], "+18494345924")
        self.assertEqual(lead["furnishing"], "unfurnished")

    def test_property_ad_is_not_classified_as_a_lead_request(self):
        keywords = {
            category: [term.upper() for term in terms]
            for category, terms in DEFAULT_LEAD_KEYWORDS.items()
        }

        self.assertEqual(
            classify_lead_intent(
                "Se renta apartamento en Los Corales, 2 habitaciones, $850 dolares",
                keywords,
            ),
            "other",
        )
        self.assertEqual(
            classify_lead_intent("Saludos, quien tiene este??", keywords),
            "property_inquiry",
        )

    def test_budget_and_bedroom_ranges_do_not_capture_other_numbers(self):
        lead = extract_lead_data({
            "sender": "+1 (849) 434-5924",
            "message": (
                "Busco apartamento de 2 a 3 habitaciones, presupuesto entre "
                "600 y 800, cerca de Primaveral"
            ),
        })

        self.assertEqual((lead["min_bedrooms"], lead["max_bedrooms"]), (2, 3))
        self.assertEqual((lead["min_price"], lead["max_price"]), (600, 800))
        self.assertEqual(lead["preferred_location"], "Primaveral")
        self.assertEqual(lead["budget_currency"], "")

    def test_exact_duplicate_requests_from_different_people_are_kept(self):
        requests = [
            {"destination": "property_inquiry", "sender": "Ana", "message": "Busco casa"},
            {"destination": "property_inquiry", "sender": "Luis", "message": "Busco casa"},
        ]

        self.assertEqual(len(dedupe_messages(requests)), 2)

    def test_matching_uses_any_requested_location_and_respects_currency(self):
        lead = SimpleNamespace(
            listing_type="rent",
            property_type="apartment",
            min_bedrooms=2,
            max_bedrooms=2,
            min_price=600,
            max_price=800,
            budget_currency="USD",
            preferred_location="Costa Cana, Brisas",
            city="",
            province="",
        )
        property_listing = SimpleNamespace(
            listing_type="rent",
            property_type="apartment",
            bedrooms=2,
            price=700,
            currency="USD",
            city="Punta Cana",
            province="La Altagracia",
            address="Brisas de Punta Cana",
            title="Apartment",
            description="",
        )

        _, matching_reasons = compute_match_score(lead, property_listing)
        property_listing.currency = "DOP"
        _, mismatched_reasons = compute_match_score(lead, property_listing)

        self.assertIn("preferred location", matching_reasons)
        self.assertIn("price", matching_reasons)
        self.assertNotIn("price", mismatched_reasons)

    def test_rejects_unsafe_zip_member_and_cleans_extraction(self):
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as archive:
            archive.writestr("../outside.txt", "unsafe")

        with tempfile.TemporaryDirectory() as output_dir:
            zip_path = Path(output_dir) / "unsafe.zip"
            zip_path.write_bytes(buffer.getvalue())

            with self.assertRaisesRegex(ValueError, "unsafe file path"):
                unzip_chat_export(str(zip_path), output_dir)

            self.assertEqual(list(Path(output_dir).glob("whatsapp_chat_*")), [])


class WhatsAppImportEndpointTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = "/api/estates/whatsapp-import/import_chat/"
        user = get_user_model().objects.create_user(
            username="staff",
            password="test-password",
            is_staff=True,
        )
        self.client.force_authenticate(user=user)

    def test_import_saves_associated_media_for_lead(self):
        with tempfile.TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root, MEDIA_URL="/media/"):
                upload = SimpleUploadedFile(
                    "chat.zip", build_chat_zip(), content_type="application/zip"
                )
                response = self.client.post(
                    self.url,
                    {"zip_file": upload, "recent_days": "30"},
                    format="multipart",
                )

                self.assertEqual(response.status_code, 201, response.data)
                self.assertEqual(response.data["imported"], 1)
                self.assertEqual(response.data["media_imported"], 1)
                lead = Lead.objects.get()
                self.assertEqual(lead.name, "+12345678901")
                self.assertEqual(lead.phone, "+12345678901")
                self.assertEqual(lead.source_sender, "+1 234 567 8901")
                self.assertEqual(lead.listing_type, "rent")
                self.assertIn("Looking to rent", lead.notes)
                self.assertEqual(len(lead.attachments), 1)
                self.assertTrue(Path(media_root, lead.attachments[0]["url"].split("/media/")[-1]).is_file())

    def test_import_without_media_succeeds(self):
        with tempfile.TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root, MEDIA_URL="/media/"):
                upload = SimpleUploadedFile(
                    "chat.zip", build_chat_zip(include_media=False), content_type="application/zip"
                )
                response = self.client.post(
                    self.url,
                    {"zip_file": upload, "recent_days": "30"},
                    format="multipart",
                )

                self.assertEqual(response.status_code, 201, response.data)
                self.assertEqual(response.data["media_imported"], 0)
                self.assertEqual(Lead.objects.get().attachments, [])

    def test_import_saves_unclassified_messages_and_deduplicates_rescans(self):
        message_date = date.today().strftime("%m/%d/%y")
        chat = (
            f"{message_date}, 9:15 PM - +1 234 567 8901: "
            "Looking to rent a 2 bedroom apartment in Punta Cana\n"
            f"{message_date}, 9:20 PM - Broker Ana: "
            "Good afternoon everyone"
        )
        with tempfile.TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root, MEDIA_URL="/media/"):
                for expected_new, expected_existing in ((1, 0), (0, 1)):
                    upload = SimpleUploadedFile(
                        "chat.zip",
                        build_chat_zip(include_media=True, messages=chat),
                        content_type="application/zip",
                    )
                    response = self.client.post(
                        self.url,
                        {"zip_file": upload, "recent_days": "30"},
                        format="multipart",
                    )
                    self.assertEqual(response.status_code, 201, response.data)
                    self.assertEqual(response.data["inbox_saved"], expected_new)
                    self.assertEqual(response.data["inbox_existing"], expected_existing)
                    self.assertEqual(
                        response.data["media_imported"],
                        1 if expected_new else 0,
                    )

        inbox_item = ScanInboxItem.objects.get()
        self.assertEqual(inbox_item.sender, "Broker Ana")
        self.assertEqual(inbox_item.message, "Good afternoon everyone")
        self.assertEqual(inbox_item.status, "pending")
        self.assertEqual(len(inbox_item.attachments), 1)
        pending = self.client.get("/api/estates/scan-inbox/")
        self.assertEqual(pending.data["count"], 1)

    def test_reimport_keeps_one_copy_but_distinct_requests_from_same_phone(self):
        with tempfile.TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root, MEDIA_URL="/media/"):
                for _ in range(2):
                    upload = SimpleUploadedFile(
                        "chat.zip",
                        build_chat_zip(include_media=False),
                        content_type="application/zip",
                    )
                    response = self.client.post(
                        self.url,
                        {"zip_file": upload, "recent_days": "30"},
                        format="multipart",
                    )
                    self.assertIn(response.status_code, (201, 207), response.data)

                self.assertEqual(Lead.objects.count(), 1)

    def test_import_stores_distinct_requests_from_the_same_phone(self):
        message_date = date.today().strftime("%m/%d/%y")
        chat = (
            f"{message_date}, 9:15 PM - +1 234 567 8901: "
            "Looking to rent a 2 bedroom apartment in Punta Cana\n"
            f"{message_date}, 9:18 PM - +1 234 567 8901: "
            "Busco una casa de 3 habitaciones en Bávaro"
        )
        with tempfile.TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root, MEDIA_URL="/media/"):
                upload = SimpleUploadedFile(
                    "chat.zip",
                    build_chat_zip(include_media=False, messages=chat),
                    content_type="application/zip",
                )
                response = self.client.post(
                    self.url,
                    {"zip_file": upload, "recent_days": "30"},
                    format="multipart",
                )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["imported"], 2)
        self.assertEqual(Lead.objects.filter(phone="+12345678901").count(), 2)

    def test_request_queue_filters_open_and_terminal_statuses(self):
        Lead.objects.create(name="Open request", phone="", status="new")
        completed = Lead.objects.create(
            name="Completed request", phone="", status="completed"
        )
        Lead.objects.create(name="Legacy closed request", phone="", status="closed")
        unavailable = Lead.objects.create(
            name="Unavailable request", phone="", status="unavailable"
        )

        open_response = self.client.get("/api/estates/leads/?status=open")
        completed_response = self.client.get("/api/estates/leads/?status=completed")
        unavailable_response = self.client.get(
            "/api/estates/leads/?status=unavailable"
        )

        self.assertEqual(open_response.data["count"], 1)
        self.assertEqual(completed_response.data["count"], 2)
        self.assertIn(
            completed.id,
            [result["id"] for result in completed_response.data["results"]],
        )
        self.assertEqual(
            unavailable_response.data["results"][0]["id"], unavailable.id
        )

    def test_request_can_be_marked_completed_or_unavailable(self):
        lead = Lead.objects.create(name="Request", phone="", status="new")

        completed_response = self.client.patch(
            f"/api/estates/leads/{lead.id}/",
            {"status": "completed"},
            format="json",
        )
        self.assertEqual(completed_response.status_code, 200)
        self.assertEqual(completed_response.data["status"], "completed")

        unavailable_response = self.client.patch(
            f"/api/estates/leads/{lead.id}/",
            {"status": "unavailable"},
            format="json",
        )
        self.assertEqual(unavailable_response.status_code, 200)
        self.assertEqual(unavailable_response.data["status"], "unavailable")

    def test_request_summary_filters_and_counts_types_and_bedrooms(self):
        Lead.objects.create(
            name="Two bed apartment",
            phone="",
            property_type="apartment",
            min_bedrooms=2,
            max_bedrooms=2,
        )
        Lead.objects.create(
            name="Second two bed apartment",
            phone="",
            property_type="apartment",
            min_bedrooms=2,
            max_bedrooms=2,
        )
        Lead.objects.create(
            name="Range house",
            phone="",
            property_type="house",
            min_bedrooms=2,
            max_bedrooms=3,
        )
        Lead.objects.create(name="Unknown request", phone="")

        response = self.client.get("/api/estates/leads/summary/")

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["total"], 4)
        self.assertEqual(response.data["top_property_type"]["property_type"], "apartment")
        two_bed = sum(
            group["count"]
            for group in response.data["by_bedrooms"]
            if group["min"] == 2 and group["max"] == 2
        )
        self.assertEqual(two_bed, 2)

        filtered = self.client.get(
            "/api/estates/leads/?property_type=apartment&bedrooms=2"
        )
        self.assertEqual(filtered.data["count"], 2)

    def test_requests_export_csv_and_xlsx(self):
        Lead.objects.create(
            name="Export request",
            phone="+18095550101",
            source_sender="Broker Name",
            property_type="apartment",
            min_bedrooms=2,
            notes="WhatsApp request:\nLooking for an apartment",
        )

        csv_response = self.client.get("/api/estates/leads/export/?file_format=csv")
        self.assertEqual(csv_response.status_code, 200, csv_response.content[:100])
        self.assertIn("Original request", csv_response.content.decode("utf-8-sig"))

        xlsx_response = self.client.get("/api/estates/leads/export/?file_format=xlsx")
        self.assertEqual(xlsx_response.status_code, 200)
        workbook = load_workbook(io.BytesIO(xlsx_response.content), read_only=True)
        self.assertEqual(workbook.active["B2"].value, "Export request")
        self.assertEqual(workbook.active["L2"].value, "apartment")

        invalid_response = self.client.get("/api/estates/leads/export/?file_format=pdf")
        self.assertEqual(invalid_response.status_code, 400)

    def test_broker_directory_links_broker_to_request_and_created_estate(self):
        lead = Lead.objects.create(
            name="Requester broker",
            phone="+18095550101",
            source="whatsapp",
            property_type="apartment",
        )
        broker_response = self.client.post(
            "/api/estates/brokers/",
            {"name": "Broker One", "phone": "+18095550101", "company": "Agency"},
            format="json",
        )
        self.assertEqual(broker_response.status_code, 201, broker_response.data)
        broker = Broker.objects.get()

        link_response = self.client.patch(
            f"/api/estates/leads/{lead.id}/",
            {"broker": broker.id},
            format="json",
        )
        self.assertEqual(link_response.status_code, 200, link_response.data)
        self.assertEqual(link_response.data["broker_name"], "Broker One")

        estate_response = self.client.post(
            f"/api/estates/leads/{lead.id}/create_estate/",
            {
                "title": "Apartment in Punta Cana",
                "property_type": "apartment",
                "listing_type": "sale",
                "status": "draft",
                "broker": broker.id,
            },
            format="json",
        )
        self.assertEqual(estate_response.status_code, 201, estate_response.data)
        estate = Property.objects.get()
        self.assertEqual(estate.source_lead, lead)
        self.assertEqual(estate.broker, broker)
        self.assertEqual(estate.status, "draft")

        duplicate_response = self.client.post(
            f"/api/estates/leads/{lead.id}/create_estate/",
            {"title": "Duplicate", "property_type": "apartment", "listing_type": "sale"},
            format="json",
        )
        self.assertEqual(duplicate_response.status_code, 409)

    def test_scan_inbox_can_save_request_broker_estate_and_dismiss(self):
        request_item = ScanInboxItem.objects.create(
            fingerprint="a" * 64,
            whatsapp_group="Group",
            sender="Broker Ana",
            message_date="11/11/26",
            message_time="9:15 AM",
            message="Looking for a 2 bedroom apartment. Call 809 555 1234",
        )
        request_response = self.client.post(
            f"/api/estates/scan-inbox/{request_item.id}/save_as_request/",
            format="json",
        )
        self.assertEqual(request_response.status_code, 201, request_response.data)
        request_item.refresh_from_db()
        self.assertEqual(request_item.status, "request")
        self.assertEqual(request_response.data["phone"], "")
        self.assertEqual(request_response.data["min_bedrooms"], 2)

        broker_item = ScanInboxItem.objects.create(
            fingerprint="b" * 64,
            whatsapp_group="Group",
            sender="Broker Ana",
            message="I am a real estate broker",
        )
        broker_response = self.client.post(
            f"/api/estates/scan-inbox/{broker_item.id}/save_as_broker/",
            format="json",
        )
        self.assertEqual(broker_response.status_code, 201, broker_response.data)
        broker_item.refresh_from_db()
        self.assertEqual(broker_item.status, "broker")

        duplicate_broker_item = ScanInboxItem.objects.create(
            fingerprint="c" * 64,
            whatsapp_group="Group",
            sender="Broker Ana",
            message="Another message from same broker",
        )
        duplicate_broker_response = self.client.post(
            f"/api/estates/scan-inbox/{duplicate_broker_item.id}/save_as_broker/",
            format="json",
        )
        self.assertEqual(duplicate_broker_response.status_code, 200)
        self.assertEqual(Broker.objects.count(), 1)
        duplicate_broker_item.refresh_from_db()
        self.assertEqual(duplicate_broker_item.broker_id, broker_item.broker_id)

        estate_item = ScanInboxItem.objects.create(
            fingerprint="d" * 64,
            whatsapp_group="Group",
            sender="Broker Ana",
            message="Se vende apartamento in Punta Cana",
        )
        estate_response = self.client.post(
            f"/api/estates/scan-inbox/{estate_item.id}/save_as_estate/",
            {
                "title": "Apartment in Punta Cana",
                "property_type": "apartment",
                "listing_type": "sale",
                "status": "draft",
                "broker": broker_item.broker_id,
            },
            format="json",
        )
        self.assertEqual(estate_response.status_code, 201, estate_response.data)
        estate_item.refresh_from_db()
        self.assertEqual(estate_item.status, "estate")
        self.assertEqual(estate_item.property.status, "draft")

        dismiss_item = ScanInboxItem.objects.create(
            fingerprint="e" * 64,
            whatsapp_group="Group",
            sender="Someone",
            message="Not relevant",
        )
        dismiss_response = self.client.post(
            f"/api/estates/scan-inbox/{dismiss_item.id}/dismiss/",
            format="json",
        )
        self.assertEqual(dismiss_response.status_code, 200)
        dismiss_item.refresh_from_db()
        self.assertEqual(dismiss_item.status, "dismissed")

    def test_analytics_summary_api_no_longer_raises_for_projects(self):
        paths = [
            "",
            "price_trends/",
            "request_volume/",
            "conversion_funnel/",
            "category_stats/",
            "location_stats/",
            "unit_status/",
        ]
        for path in paths:
            response = self.client.get(f"/api/estates/analytics/{path}")
            self.assertEqual(response.status_code, 200, (path, response.data))
        self.assertIn("total_projects", self.client.get("/api/estates/analytics/").data)

    def test_request_details_can_be_edited(self):
        lead = Lead.objects.create(name="Request", phone="", status="new")

        response = self.client.patch(
            f"/api/estates/leads/{lead.id}/",
            {
                "name": "Edited request",
                "property_type": "apartment",
                "min_bedrooms": 3,
                "preferred_location": "Punta Cana",
                "notes": "WhatsApp request:\nLooking for an apartment",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200, response.data)
        lead.refresh_from_db()
        self.assertEqual(lead.name, "Edited request")
        self.assertEqual(lead.min_bedrooms, 3)
        self.assertEqual(lead.preferred_location, "Punta Cana")

    def test_ignoring_sender_skips_future_imports_and_can_be_undone(self):
        sender = "+1 234 567 8901"
        lead = Lead.objects.create(
            name="+12345678901",
            phone="+12345678901",
            source="whatsapp",
            source_sender=sender,
            status="new",
        )
        Lead.objects.create(
            name="+12345678901",
            phone="+12345678901",
            source="whatsapp",
            source_sender=sender,
            status="completed",
        )

        ignored_response = self.client.post(
            f"/api/estates/leads/{lead.id}/ignore_user/", format="json"
        )
        self.assertEqual(ignored_response.status_code, 200, ignored_response.data)
        self.assertEqual(Lead.objects.filter(source_sender=sender, status="ignored").count(), 2)
        self.assertEqual(WhatsAppIgnoredUser.objects.count(), 1)

        ignored_list = self.client.get("/api/estates/leads/?status=ignored")
        self.assertEqual(ignored_list.data["count"], 2)

        with tempfile.TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root, MEDIA_URL="/media/"):
                upload = SimpleUploadedFile(
                    "chat.zip",
                    build_chat_zip(include_media=False),
                    content_type="application/zip",
                )
                response = self.client.post(
                    self.url,
                    {"zip_file": upload, "recent_days": "30"},
                    format="multipart",
                )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["ignored"], 1)
        self.assertEqual(Lead.objects.count(), 2)

        unignored_response = self.client.post(
            f"/api/estates/leads/{lead.id}/unignore_user/", format="json"
        )
        self.assertEqual(unignored_response.status_code, 200, unignored_response.data)
        self.assertEqual(WhatsAppIgnoredUser.objects.count(), 0)
        self.assertEqual(Lead.objects.filter(source_sender=sender, status="new").count(), 1)
        self.assertEqual(
            Lead.objects.filter(source_sender=sender, status="completed").count(),
            1,
        )

        upload = SimpleUploadedFile(
            "chat.zip",
            build_chat_zip(include_media=False),
            content_type="application/zip",
        )
        response = self.client.post(
            self.url,
            {"zip_file": upload, "recent_days": "30"},
            format="multipart",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["imported"], 1)

    def test_invalid_zip_returns_useful_error(self):
        upload = SimpleUploadedFile("chat.zip", b"not a zip", content_type="application/zip")
        response = self.client.post(
            self.url,
            {"zip_file": upload, "recent_days": "30"},
            format="multipart",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("zip", response.data["detail"].lower())

    def test_unauthenticated_import_requires_login(self):
        self.client.force_authenticate(user=None)
        response = self.client.post(self.url, {}, format="multipart")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.data["detail"],
            "Authentication credentials were not provided.",
        )


class EstateManagementApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        user = get_user_model().objects.create_user(
            username="estate-management-staff",
            password="test-password",
            is_staff=True,
        )
        self.client.force_authenticate(user=user)

    def test_owner_directory_and_property_project_relationships(self):
        owner_response = self.client.post(
            "/api/estates/owners/",
            {"name": "María Owner", "phone": "8095550101", "email": "owner@example.com"},
            format="json",
        )
        self.assertEqual(owner_response.status_code, 201, owner_response.data)
        owner_id = owner_response.data["id"]

        broker_response = self.client.post(
            "/api/estates/brokers/",
            {"name": "Carlos Broker", "phone": "8095550102"},
            format="json",
        )
        self.assertEqual(broker_response.status_code, 201, broker_response.data)
        broker_id = broker_response.data["id"]

        project_response = self.client.post(
            "/api/estates/projects/",
            {
                "name": "Punta Cana Homes",
                "city": "Punta Cana",
                "province": "La Altagracia",
                "owner": owner_id,
                "broker": broker_id,
            },
            format="json",
        )
        self.assertEqual(project_response.status_code, 201, project_response.data)
        project = Project.objects.get(pk=project_response.data["id"])
        self.assertEqual(project.owner_id, owner_id)
        self.assertEqual(project.broker_id, broker_id)

        property_response = self.client.post(
            "/api/estates/properties/",
            {
                "title": "Owner's apartment",
                "status": "available",
                "owner": owner_id,
                "broker": broker_id,
            },
            format="json",
        )
        self.assertEqual(property_response.status_code, 201, property_response.data)
        self.assertEqual(
            Property.objects.get(pk=property_response.data["id"]).owner_id,
            owner_id,
        )

        owner = Owner.objects.get(pk=owner_id)
        self.assertEqual(owner.properties.count(), 1)
        self.assertEqual(owner.projects.count(), 1)

    def test_data_quality_summary_reports_missing_fields_for_each_dataset(self):
        Broker.objects.create(name="Incomplete broker")
        Owner.objects.create(name="Incomplete owner")
        Property.objects.create(title="Incomplete estate", status="draft")
        Project.objects.create(name="Incomplete project")
        Lead.objects.create(name="Incomplete request")

        response = self.client.get("/api/estates/data-quality/summary/")

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["incomplete_counts"], {
            "estate": 1,
            "project": 1,
            "request": 1,
            "broker": 1,
            "owner": 1,
        })
        self.assertEqual(len(response.data["records"]), 5)
        self.assertTrue(all(record["missing_fields"] for record in response.data["records"]))


class EstateWritePermissionTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_anonymous_cannot_create_or_delete_estates(self):
        response = self.client.post(
            "/api/estates/properties/",
            {"title": "Public injection", "status": "available"},
            format="json",
        )
        self.assertEqual(response.status_code, 403, response.data)

        estate = Property.objects.create(title="Existing estate", status="available")
        delete_response = self.client.delete(
            f"/api/estates/properties/{estate.slug}/"
        )
        self.assertEqual(delete_response.status_code, 403, delete_response.data)

    def test_anonymous_can_read_available_estates_only(self):
        Property.objects.create(title="Listed estate", status="available")
        Property.objects.create(title="Draft estate", status="draft")

        response = self.client.get("/api/estates/properties/")

        self.assertEqual(response.status_code, 200, response.data)
        titles = [item["title"] for item in response.data["results"]]
        self.assertIn("Listed estate", titles)
        self.assertNotIn("Draft estate", titles)

    def test_non_staff_user_cannot_manage_projects_or_units(self):
        user = get_user_model().objects.create_user(
            username="regular-user",
            password="test-password",
            is_staff=False,
        )
        self.client.force_authenticate(user=user)

        property_response = self.client.post(
            "/api/estates/properties/",
            {"title": "Regular user estate", "status": "available"},
            format="json",
        )
        self.assertEqual(property_response.status_code, 403, property_response.data)

        project_response = self.client.post(
            "/api/estates/projects/",
            {"name": "Regular project"},
            format="json",
        )
        self.assertEqual(project_response.status_code, 403, project_response.data)

        project = Project.objects.create(name="Staff project")
        unit_response = self.client.post(
            "/api/estates/project-units/",
            {"project": project.id, "unit_number": "101"},
            format="json",
        )
        self.assertEqual(unit_response.status_code, 403, unit_response.data)

        bulk_response = self.client.post(
            "/api/estates/project-units/bulk_create/",
            {"project": project.id, "units": [{"unit_number": "102"}]},
            format="json",
        )
        self.assertEqual(bulk_response.status_code, 403, bulk_response.data)

