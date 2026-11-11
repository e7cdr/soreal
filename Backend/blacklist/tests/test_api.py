from django.test import TestCase

from blacklist.models import BlacklistedPerson
from estates.models import Property


class BlacklistModelTest(TestCase):
    def test_create_person(self):
        person = BlacklistedPerson.objects.create(
            full_name="Test Person",
            visibility="private",
        )
        self.assertIsNotNone(person.case_id)
        self.assertEqual(person.visibility, "private")

    def test_default_visibility_private(self):
        person = BlacklistedPerson.objects.create(full_name="Test")
        self.assertEqual(person.visibility, "private")


class EstateModelTest(TestCase):
    def test_create_property(self):
        prop = Property.objects.create(
            title="Test House",
            property_type="house",
            listing_type="sale",
            price=100000,
            status="available",
        )
        self.assertEqual(prop.slug, "test-house")
