from wagtail.snippets.models import register_snippet

# BlacklistedPerson is registered via @register_snippet in models.py.
# This file exists so blacklist.apps.ready() can import it without error.
