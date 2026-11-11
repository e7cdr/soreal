import json
import os
import sqlite3

from django.conf import settings
from django.core.files import File
from django.core.management.base import BaseCommand, CommandError

from wagtail.models import Collection
from wagtail.images.models import Image

from blacklist.models import BlacklistedPerson, BlacklistImage, BlacklistReporter
from blacklist.utils import generate_case_id


class Command(BaseCommand):
    help = "Import cases and images from an existing ListaNegra project SQLite DB."

    def add_arguments(self, parser):
        parser.add_argument(
            "--source",
            type=str,
            required=True,
            help="Path to the ListaNegra project directory (containing db.sqlite3 and media/).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Parse and report what would be imported without saving.",
        )

    def handle(self, *args, **options):
        source = options["source"]
        dry_run = options["dry_run"]

        db_path = os.path.join(source, "db.sqlite3")
        media_path = os.path.join(source, "media")

        if not os.path.exists(db_path):
            raise CommandError(f"Database not found: {db_path}")

        # Ensure a collection exists for imported images
        if not dry_run:
            collection = Collection.get_first_root_node()

        old_conn = sqlite3.connect(db_path)
        old_conn.row_factory = sqlite3.Row
        old_cur = old_conn.cursor()

        imported = 0
        skipped = 0
        errors = []

        try:
            old_cur.execute("SELECT * FROM blacklist_deshonestcitizen")
            citizens = old_cur.fetchall()
        except sqlite3.OperationalError as e:
            raise CommandError(f"Could not read blacklist_deshonestcitizen: {e}")

        for citizen in citizens:
            case_id = citizen["case_id"]
            full_name = citizen["name"]
            id_type = citizen["id_type"]
            identification = citizen["identification"]
            added = citizen["added"]

            # Parse old StreamField case JSON
            legacy_case_data = None
            description = None
            incident_location = None
            incident_date = None
            try:
                case_blocks = json.loads(citizen["case"]) if citizen["case"] else []
                legacy_case_data = case_blocks
                for block in case_blocks:
                    btype = block.get("type")
                    bvalue = block.get("value")
                    if btype == "description":
                        description = bvalue
                    elif btype == "location":
                        incident_location = bvalue
                    elif btype == "date":
                        incident_date = bvalue
            except Exception as e:
                errors.append(f"Case {case_id}: failed to parse case JSON: {e}")

            # Check for duplicate
            if BlacklistedPerson.objects.filter(case_id=case_id).exists():
                skipped += 1
                self.stdout.write(
                    self.style.WARNING(f"Skipped duplicate case_id: {case_id}")
                )
                continue

            if dry_run:
                self.stdout.write(
                    f"[DRY-RUN] Would import case {case_id}: {full_name}"
                )
                imported += 1
                continue

            person = BlacklistedPerson(
                case_id=case_id,
                full_name=full_name,
                id_type=id_type,
                identification=identification,
                description=description,
                incident_location=incident_location,
                incident_date=incident_date if incident_date else None,
                visibility="private",
                source="Imported from ListaNegra",
                legacy_case_data=legacy_case_data,
                created_by="import_listanegra",
            )
            person.save()

            # Import images
            old_cur.execute(
                "SELECT * FROM blacklist_dc_images WHERE page_id = ?",
                (citizen["page_ptr_id"],),
            )
            images = old_cur.fetchall()
            for img in images:
                old_cur.execute(
                    "SELECT * FROM wagtailimages_image WHERE id = ?",
                    (img["image_id"],),
                )
                wagtail_image = old_cur.fetchone()
                if not wagtail_image:
                    continue

                image_file_path = os.path.join(media_path, wagtail_image["file"])
                try:
                    with open(image_file_path, "rb") as f:
                        wagtail_img = Image.objects.create(
                            title=wagtail_image["title"]
                            or f"Image for {case_id}",
                            collection=collection,
                            width=wagtail_image["width"],
                            height=wagtail_image["height"],
                        )
                        wagtail_img.file.save(
                            os.path.basename(wagtail_image["file"]),
                            File(f),
                            save=True,
                        )
                    BlacklistImage.objects.create(
                        person=person,
                        image=wagtail_img,
                        caption=img["caption"],
                        is_public=False,
                    )
                except FileNotFoundError:
                    errors.append(
                        f"Case {case_id}: image file not found: {image_file_path}"
                    )
                except Exception as e:
                    errors.append(
                        f"Case {case_id}: failed to import image {wagtail_image['file']}: {e}"
                    )

            # Import victims/reporters
            old_cur.execute(
                "SELECT * FROM blacklist_victims WHERE page_id = ?",
                (citizen["page_ptr_id"],),
            )
            victims = old_cur.fetchall()
            for victim in victims:
                BlacklistReporter.objects.create(
                    person=person,
                    name=victim["victim_name"],
                    phone=victim["victim_telephone"],
                    is_public=False,
                )

            imported += 1
            self.stdout.write(
                self.style.SUCCESS(f"Imported case {case_id}: {full_name}")
            )

        old_conn.close()

        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                f"Import complete: {imported} imported, {skipped} skipped."
            )
        )
        if errors:
            self.stdout.write(self.style.ERROR(f"Errors ({len(errors)}):"))
            for e in errors:
                self.stdout.write(self.style.ERROR(f"  - {e}"))
