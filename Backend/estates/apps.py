from django.apps import AppConfig


class EstatesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "estates"

    def ready(self):
        import estates.wagtail_hooks  # noqa: F401
