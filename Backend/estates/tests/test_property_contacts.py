from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from estates.models import Broker, Owner, Property


class PropertyContactSerializerTests(TestCase):
    """Owner contact details must never leak to anonymous visitors."""

    def setUp(self):
        self.owner = Owner.objects.create(name="Owner One", phone="+1 809 555 0100")
        self.broker = Broker.objects.create(name="Broker One", phone="+1 829 555 0200")
        self.estate = Property.objects.create(
            title="Beach villa",
            status="available",
            broker=self.broker,
            owner=self.owner,
        )
        self.client = APIClient()
        self.url = f"/api/estates/properties/{self.estate.slug}/"

    def test_anonymous_gets_broker_contact_but_no_owner_contact(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["broker_name"], "Broker One")
        self.assertEqual(response.data["broker_phone"], "+1 829 555 0200")
        self.assertIsNone(response.data["owner_name"])
        self.assertIsNone(response.data["owner_phone"])

    def test_staff_gets_owner_contact(self):
        staff = get_user_model().objects.create_user(
            username="staff-user",
            password="staff-pass",
            is_staff=True,
        )
        self.client.force_authenticate(user=staff)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["owner_name"], "Owner One")
        self.assertEqual(response.data["owner_phone"], "+1 809 555 0100")
        self.assertEqual(response.data["broker_phone"], "+1 829 555 0200")

    def test_estate_without_contacts_returns_empty_contact_fields(self):
        estate = Property.objects.create(title="No contacts", status="available")

        response = self.client.get(f"/api/estates/properties/{estate.slug}/")

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["broker_name"])
        self.assertIsNone(response.data["broker_phone"])
        self.assertIsNone(response.data["owner_name"])
        self.assertIsNone(response.data["owner_phone"])
