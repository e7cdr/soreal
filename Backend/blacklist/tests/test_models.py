from django.core.exceptions import ValidationError as DjangoValidationError
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from blacklist.models import (
    BlacklistedPerson,
    BlacklistImage,
    BlacklistReporter,
    ReportSubmission,
)
from blacklist.utils import generate_case_id
from estates.models import Property


class StaffLoginApiTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="staff-login",
            password="Correct-password-123",
            is_staff=True,
        )

    def test_valid_staff_login_returns_token_and_user(self):
        response = self.client.post(
            "/api/blacklist/auth/login/",
            {"username": "staff-login", "password": "Correct-password-123"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["token"])
        self.assertEqual(response.data["user"]["username"], "staff-login")

    def test_invalid_credentials_return_a_readable_validation_message(self):
        response = self.client.post(
            "/api/blacklist/auth/login/",
            {"username": "staff-login", "password": "incorrect"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn(
            "Unable to log in with provided credentials.",
            response.data["non_field_errors"],
        )


class CaseIdGenerationTest(TestCase):
    def test_case_id_format(self):
        person = BlacklistedPerson(
            full_name="Test Person",
            visibility="private",
        )
        person.save()
        self.assertTrue(person.case_id.startswith("LN-"))
        self.assertEqual(len(person.case_id), 9)  # LN- + 6 random chars

    def test_case_id_unique(self):
        p1 = BlacklistedPerson(full_name="A", visibility="private")
        p1.save()
        p2 = BlacklistedPerson(full_name="B", visibility="private")
        p2.save()
        self.assertNotEqual(p1.case_id, p2.case_id)


class MaskedIdentificationTest(TestCase):
    def test_mask_short_id(self):
        person = BlacklistedPerson(identification="123")
        self.assertEqual(person.masked_identification(), "***")

    def test_mask_long_id(self):
        person = BlacklistedPerson(identification="40236483762")
        self.assertEqual(person.masked_identification(), "*******3762")


class BlacklistAPITest(TestCase):
    def setUp(self):
        self.user = User.objects.create_superuser("admin", "admin@test.com", "pass")
        self.token = Token.objects.create(user=self.user)
        self.client.defaults["HTTP_AUTHORIZATION"] = f"Token {self.token.key}"

        self.person = BlacklistedPerson.objects.create(
            full_name="Jane Doe",
            id_type="ID_Card",
            identification="12345678",
            status="verified",
            category="fraud",
            visibility="public",
            description="<p>Test description</p>",
        )

    def test_public_list_sees_public_records(self):
        resp = self.client.get("/api/blacklist/persons/")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["count"], 1)

    def test_public_detail_returns_masked_id(self):
        # Use unauthenticated client for public serializer
        self.client.defaults = {}
        resp = self.client.get(f"/api/blacklist/persons/{self.person.case_id}/")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["full_name"], "Jane Doe")
        self.assertEqual(data["masked_id"], "****5678")
        self.assertNotIn("identification", data)

    def test_staff_detail_returns_full_id(self):
        self.client.defaults["HTTP_AUTHORIZATION"] = f"Token {self.token.key}"
        resp = self.client.get(f"/api/blacklist/persons/{self.person.case_id}/")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["identification"], "12345678")

    def test_filter_by_status(self):
        BlacklistedPerson.objects.create(
            full_name="John Smith",
            status="resolved",
            visibility="public",
        )
        resp = self.client.get("/api/blacklist/persons/?status=verified")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["count"], 1)
        self.assertEqual(data["results"][0]["full_name"], "Jane Doe")

    def test_search_by_name(self):
        resp = self.client.get("/api/blacklist/persons/?q=Jane")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["count"], 1)

    def test_stats_endpoint(self):
        self.client.defaults = {}
        with self.assertNumQueries(1):
            resp = self.client.get("/api/blacklist/persons/stats/")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["by_status"]["verified"], 1)


class EstatesAPITest(TestCase):
    def setUp(self):
        from estates.models import Property

        self.property = Property.objects.create(
            title="Test House",
            property_type="house",
            listing_type="sale",
            price=100000,
            currency="USD",
            city="Santo Domingo",
            status="available",
        )

    def test_estates_list(self):
        resp = self.client.get("/api/estates/properties/")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["count"], 1)

    def test_estate_detail(self):
        resp = self.client.get(f"/api/estates/properties/{self.property.slug}/")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["title"], "Test House")


class ProjectListAPITest(TestCase):
    def setUp(self):
        from estates.models import Project, ProjectUnit

        self.user = User.objects.create_superuser(
            "projects-admin", "projects@test.com", "pass"
        )
        self.token = Token.objects.create(user=self.user)
        self.client.defaults["HTTP_AUTHORIZATION"] = f"Token {self.token.key}"
        self.project = Project.objects.create(name="Project API Test")
        ProjectUnit.objects.create(
            project=self.project, unit_number="101", status="available"
        )
        ProjectUnit.objects.create(
            project=self.project, unit_number="102", status="sold"
        )

    def test_project_list_returns_counts_without_unit_details(self):
        response = self.client.get("/api/estates/projects/")
        self.assertEqual(response.status_code, 200)
        project = response.json()["results"][0]
        self.assertNotIn("units", project)
        self.assertEqual(project["unit_count"], 2)
        self.assertEqual(project["available_count"], 1)
        self.assertEqual(project["sold_count"], 1)

    def test_project_unit_list_accepts_project_slug(self):
        response = self.client.get(
            f"/api/estates/project-units/?project={self.project.slug}"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["count"], 2)

    def test_bulk_create_accepts_project_slug(self):
        response = self.client.post(
            "/api/estates/project-units/bulk_create/",
            {
                "project": self.project.slug,
                "units": [{"unit_number": "103"}],
            },
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(response.json()["created_units"]), 1)
        self.assertEqual(response.json()["errors"], [])


class InquiryScreeningTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_superuser("admin", "admin@test.com", "pass")
        self.token = Token.objects.create(user=self.user)
        self.client.defaults["HTTP_AUTHORIZATION"] = f"Token {self.token.key}"

        self.blacklisted = BlacklistedPerson.objects.create(
            full_name="Bad Tenant",
            identification="BAD123",
            visibility="private",
        )
        self.clean_person = BlacklistedPerson.objects.create(
            full_name="Good Tenant",
            identification="GOOD456",
            visibility="private",
        )

        self.property = Property.objects.create(
            title="Test Rental",
            property_type="apartment",
            listing_type="rent",
            price=1000,
            city="Santo Domingo",
            status="available",
        )

    def test_inquiry_auto_screens_against_blacklist(self):
        resp = self.client.post(
            "/api/estates/inquiries/",
            {
                "property": self.property.id,
                "name": "Bad Tenant",
                "email": "bad@example.com",
                "id_type": "ID_Card",
                "identification": "BAD123",
                "message": "Interested in renting",
            },
        )
        self.assertEqual(resp.status_code, 201)
        data = resp.json()
        self.assertEqual(data["screening_status"], "flagged")
        self.assertEqual(data["matched_person_case_id"], self.blacklisted.case_id)

    def test_inquiry_auto_screens_clean(self):
        # Use an ID that is NOT in the blacklist
        resp = self.client.post(
            "/api/estates/inquiries/",
            {
                "property": self.property.id,
                "name": "Good Tenant",
                "email": "good@example.com",
                "id_type": "ID_Card",
                "identification": "CLEAN789",
                "message": "Interested in renting",
            },
        )
        self.assertEqual(resp.status_code, 201)
        data = resp.json()
        self.assertEqual(data["screening_status"], "clean")
        self.assertIsNone(data["matched_person_case_id"])

    def test_staff_can_manual_screen(self):
        # Create inquiry without screening first (identification that matches)
        resp = self.client.post(
            "/api/estates/inquiries/",
            {
                "property": self.property.id,
                "name": "Bad Tenant",
                "email": "bad@example.com",
                "id_type": "ID_Card",
                "identification": "BAD123",
                "message": "Interested in renting",
            },
        )
        inquiry_id = resp.json()["id"]

        # Manually screen
        resp = self.client.post(
            f"/api/estates/inquiries/{inquiry_id}/screen/"
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["screening_status"], "flagged")
        # matched_person_case_id is the auto-generated case_id (e.g. LN-XXXXXX)
        self.assertIsNotNone(data["matched_person_case_id"])
        self.assertEqual(data["matched_person_name"], "Bad Tenant")

    def test_staff_can_create_application(self):
        # Create a flagged inquiry first
        resp = self.client.post(
            "/api/estates/inquiries/",
            {
                "property": self.property.id,
                "name": "Bad Tenant",
                "email": "bad@example.com",
                "id_type": "ID_Card",
                "identification": "BAD123",
                "message": "Interested in renting",
            },
        )
        inquiry_id = resp.json()["id"]

        # Create application
        resp = self.client.post(
            f"/api/estates/inquiries/{inquiry_id}/create_application/"
        )
        self.assertEqual(resp.status_code, 201)
        data = resp.json()
        self.assertEqual(data["decision"], "pending")
        self.assertEqual(data["screening_status"], "flagged")

    def test_staff_can_decide_application(self):
        # Create inquiry + application
        resp = self.client.post(
            "/api/estates/inquiries/",
            {
                "property": self.property.id,
                "name": "Bad Tenant",
                "email": "bad@example.com",
                "id_type": "ID_Card",
                "identification": "BAD123",
                "message": "Interested in renting",
            },
        )
        inquiry_id = resp.json()["id"]
        self.client.post(f"/api/estates/inquiries/{inquiry_id}/create_application/")

        # Get application ID
        resp = self.client.get("/api/estates/applications/")
        app_id = resp.json()["results"][0]["id"]

        # Approve
        resp = self.client.post(
            f"/api/estates/applications/{app_id}/decide/",
            {"decision": "approved", "decision_notes": "Looks good"},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["decision"], "approved")
        self.assertEqual(data["decision_notes"], "Looks good")


class SavedSearchTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_superuser("admin", "admin@test.com", "pass")
        self.token = Token.objects.create(user=self.user)
        self.client.defaults["HTTP_AUTHORIZATION"] = f"Token {self.token.key}"

        self.property = Property.objects.create(
            title="Test House",
            property_type="house",
            listing_type="sale",
            price=100000,
            currency="USD",
            city="Santo Domingo",
            status="available",
        )

    def test_staff_can_create_saved_search(self):
        import json

        resp = self.client.post(
            "/api/estates/saved-searches/",
            json.dumps(
                {
                    "name": "Cheap Houses in SD",
                    "email": "user@example.com",
                    "filters": {
                        "city": "Santo Domingo",
                        "property_type": "house",
                        "max_price": 150000,
                    },
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 201)
        data = resp.json()
        self.assertEqual(data["name"], "Cheap Houses in SD")

    def test_saved_search_matches(self):
        import json

        resp = self.client.post(
            "/api/estates/saved-searches/",
            json.dumps(
                {
                    "name": "Test Search",
                    "email": "user@example.com",
                    "filters": {
                        "city": "Santo Domingo",
                        "max_price": 200000,
                    },
                }
            ),
            content_type="application/json",
        )
        search_id = resp.json()["id"]

        resp = self.client.get(f"/api/estates/saved-searches/{search_id}/matches/")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["title"], "Test House")

    def test_duplicate_identification_rejected(self):
        BlacklistedPerson.objects.create(
            full_name="Jane Doe",
            identification="12345678",
            visibility="private",
        )
        with self.assertRaises(DjangoValidationError):
            BlacklistedPerson.objects.create(
                full_name="John Smith",
                identification="12345678",
                visibility="private",
            )


class ReportSubmissionAPITest(TestCase):
    def setUp(self):
        self.user = User.objects.create_superuser("admin", "admin@test.com", "pass")
        self.token = Token.objects.create(user=self.user)

    def test_public_can_create_submission(self):
        resp = self.client.post(
            "/api/blacklist/submissions/",
            {
                "full_name": "Reporter Person",
                "id_type": "ID_Card",
                "identification": "99988877",
                "category": "fraud",
                "incident_location": "Santo Domingo",
                "description": "Test report description",
            },
        )
        self.assertEqual(resp.status_code, 201)
        data = resp.json()
        self.assertEqual(data["full_name"], "Reporter Person")
        self.assertEqual(data["identification"], "99988877")
        self.assertEqual(data["category"], "fraud")

    def test_public_list_hidden(self):
        resp = self.client.get("/api/blacklist/submissions/")
        self.assertEqual(resp.status_code, 403)

    def test_staff_can_list_submissions(self):
        self.client.defaults["HTTP_AUTHORIZATION"] = f"Token {self.token.key}"
        ReportSubmission.objects.create(
            full_name="Sub Person",
            identification="11122233",
            category="scam",
        )
        resp = self.client.get("/api/blacklist/submissions/")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["count"], 1)

    def test_staff_can_approve_submission(self):
        self.client.defaults["HTTP_AUTHORIZATION"] = f"Token {self.token.key}"
        submission = ReportSubmission.objects.create(
            full_name="Approve Me",
            identification="44455566",
            category="fraud",
        )
        resp = self.client.post(
            f"/api/blacklist/submissions/{submission.submission_id}/approve/"
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("case_id", data)

        # Verify a BlacklistedPerson was created
        from blacklist.models import BlacklistedPerson

        person = BlacklistedPerson.objects.get(case_id=data["case_id"])
        self.assertEqual(person.full_name, "Approve Me")
        self.assertEqual(person.identification, "44455566")

        # Verify submission status updated
        submission.refresh_from_db()
        self.assertEqual(submission.status, "approved")

    def test_staff_can_reject_submission(self):
        self.client.defaults["HTTP_AUTHORIZATION"] = f"Token {self.token.key}"
        submission = ReportSubmission.objects.create(
            full_name="Reject Me",
            identification="77788899",
            category="other",
        )
        resp = self.client.post(
            f"/api/blacklist/submissions/{submission.submission_id}/reject/",
            {"rejection_reason": "Insufficient evidence"},
        )
        self.assertEqual(resp.status_code, 200)
        submission.refresh_from_db()
        self.assertEqual(submission.status, "rejected")
        self.assertEqual(submission.rejection_reason, "Insufficient evidence")

    def test_approve_duplicate_identification_rejected(self):
        self.client.defaults["HTTP_AUTHORIZATION"] = f"Token {self.token.key}"
        # Create existing blacklist record
        BlacklistedPerson.objects.create(
            full_name="Existing",
            identification="DUP123",
            visibility="private",
        )
        # Create submission with same ID
        submission = ReportSubmission.objects.create(
            full_name="Dup Sub",
            identification="DUP123",
            category="fraud",
        )
        resp = self.client.post(
            f"/api/blacklist/submissions/{submission.submission_id}/approve/"
        )
        self.assertEqual(resp.status_code, 400)
        submission.refresh_from_db()
        self.assertEqual(submission.status, "pending")
