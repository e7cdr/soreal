from django.apps import AppConfig


class BlacklistConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "blacklist"

    def ready(self):
        import blacklist.wagtail_hooks  # noqa: F401
