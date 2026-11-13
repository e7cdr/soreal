import tempfile
from io import BytesIO

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image
from rest_framework.test import APIClient
from wagtail.images import get_image_model

from estates.models import Broker, Owner, Property, PropertyImage


def _jpeg_bytes():
    buffer = BytesIO()
    Image.new("RGB", (1200, 800), "#18764a").save(buffer, format="JPEG")
    return buffer.getvalue()


class EstatePdfTests(TestCase):
    def setUp(self):
        self.broker = Broker.objects.create(
            name="Broker One",
            phone="+1 809 555 0100",
            email="broker@example.com",
        )
        self.owner = Owner.objects.create(
            name="Owner Private",
            phone="+1 809 555 9999",
        )
        self.estate = Property.objects.create(
            title="Beach villa",
            description="<p>Ocean view</p><ul><li>Pool</li><li>Garden</li></ul>",
            status="available",
            property_type="villa",
            listing_type="sale",
            price="250000",
            currency="USD",
            bedrooms=4,
            bathrooms=3,
            area_sqm="320",
            city="Punta Cana",
            province="La Altagracia",
            broker=self.broker,
            owner=self.owner,
        )
        self.client = APIClient()

    def test_fact_sheet_returns_pdf(self):
        response = self.client.get(
            f"/api/estates/properties/{self.estate.slug}/pdf/"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertTrue(response.content.startswith(b"%PDF"))
        self.assertIn("attachment;", response["Content-Disposition"])
        self.assertIn("factsheet", response["Content-Disposition"])

    def test_brochure_and_spanish_labels_return_pdf(self):
        response = self.client.get(
            f"/api/estates/properties/{self.estate.slug}/pdf/"
            "?layout=brochure&lang=es"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertTrue(response.content.startswith(b"%PDF"))
        self.assertIn("brochure", response["Content-Disposition"])

    def test_invalid_layout_falls_back_to_fact_sheet(self):
        response = self.client.get(
            f"/api/estates/properties/{self.estate.slug}/pdf/?layout=nope"
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("factsheet", response["Content-Disposition"])

    def test_anonymous_cannot_download_draft_pdf(self):
        draft = Property.objects.create(title="Secret draft", status="draft")

        response = self.client.get(
            f"/api/estates/properties/{draft.slug}/pdf/"
        )

        self.assertEqual(response.status_code, 404)

    def test_staff_can_download_draft_pdf(self):
        staff = get_user_model().objects.create_user(
            username="pdf-staff",
            password="pdf-pass",
            is_staff=True,
        )
        draft = Property.objects.create(title="Secret draft", status="draft")
        self.client.force_authenticate(user=staff)

        response = self.client.get(
            f"/api/estates/properties/{draft.slug}/pdf/"
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.content.startswith(b"%PDF"))

    def test_bulk_pdf_requires_ids(self):
        response = self.client.get("/api/estates/properties/bulk-pdf/")

        self.assertEqual(response.status_code, 400)

    def test_bulk_pdf_returns_combined_document(self):
        second = Property.objects.create(
            title="City apartment",
            status="available",
            property_type="apartment",
            listing_type="rent",
            price="1200",
            currency="USD",
            city="Santo Domingo",
        )

        response = self.client.get(
            f"/api/estates/properties/bulk-pdf/?ids={self.estate.id},{second.id}"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertTrue(response.content.startswith(b"%PDF"))
        self.assertIn("factsheets", response["Content-Disposition"])

    def test_bulk_pdf_excludes_inaccessible_drafts(self):
        draft = Property.objects.create(title="Secret draft", status="draft")
        response = self.client.get(
            f"/api/estates/properties/bulk-pdf/?ids={draft.id}"
        )

        self.assertEqual(response.status_code, 404)

    def test_bulk_pdf_rejects_more_than_fifty_estates(self):
        ids = ",".join(str(index) for index in range(1, 52))
        response = self.client.get(
            f"/api/estates/properties/bulk-pdf/?ids={ids}"
        )

        self.assertEqual(response.status_code, 400)

    def test_pdf_with_cover_image_is_still_pdf(self):
        with tempfile.TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root, MEDIA_URL="/media/"):
                image = get_image_model().objects.create(
                    title="Cover",
                    file=SimpleUploadedFile(
                        "cover.jpg",
                        _jpeg_bytes(),
                        content_type="image/jpeg",
                    ),
                )
                PropertyImage.objects.create(
                    property=self.estate,
                    image=image,
                    is_cover=True,
                )

                response = self.client.get(
                    f"/api/estates/properties/{self.estate.slug}/pdf/"
                )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.content.startswith(b"%PDF"))
        self.assertIn(b"/Subtype /Image", response.content)
