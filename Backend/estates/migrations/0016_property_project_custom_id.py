import secrets
import string

from django.db import migrations, models


def populate_custom_ids(apps, schema_editor):
    Property = apps.get_model("estates", "Property")
    Project = apps.get_model("estates", "Project")
    alphabet = string.ascii_uppercase + string.digits

    for property_obj in Property.objects.all().iterator():
        prefix = "RQ" if property_obj.source_lead_id else "NM"
        while True:
            custom_id = f"{prefix}-" + "".join(secrets.choice(alphabet) for _ in range(5))
            if not Property.objects.filter(custom_id=custom_id).exists():
                Property.objects.filter(pk=property_obj.pk).update(custom_id=custom_id)
                break

    for project in Project.objects.all().iterator():
        while True:
            custom_id = "PR-" + "".join(secrets.choice(alphabet) for _ in range(5))
            if not Project.objects.filter(custom_id=custom_id).exists():
                Project.objects.filter(pk=project.pk).update(custom_id=custom_id)
                break


class Migration(migrations.Migration):

    dependencies = [
        ("estates", "0015_leadleadmatch"),
    ]

    operations = [
        migrations.AddField(
            model_name="property",
            name="custom_id",
            field=models.CharField(editable=False, max_length=8, null=True, unique=True),
        ),
        migrations.AddField(
            model_name="project",
            name="custom_id",
            field=models.CharField(editable=False, max_length=8, null=True, unique=True),
        ),
        migrations.RunPython(populate_custom_ids, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="property",
            name="custom_id",
            field=models.CharField(editable=False, max_length=8, unique=True),
        ),
        migrations.AlterField(
            model_name="project",
            name="custom_id",
            field=models.CharField(editable=False, max_length=8, unique=True),
        ),
    ]
