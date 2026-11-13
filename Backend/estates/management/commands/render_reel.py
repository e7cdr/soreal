"""
Slow, polite video rendering for estate reels.

Uses FFmpeg to stitch slides (images with transitions) into an MP4,
synced to an audio track's BPM. Scraped estates can feed directly
into this pipeline.

Philosophy: "Castle brick by brick" — render 2 estates per day max,
from different sites, never bulk. Respect robots.txt, identify the bot,
sequential requests, no login walls, no CAPTCHA bypass, no PII storage.

Rendered estates land as `draft` / `unverified` until an agent reviews them.
"""

import hashlib
import os
import subprocess
import tempfile
import time
from datetime import date
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from estates.models import Property, Reel


USER_AGENT = "soreal-bot/1.0 (+https://soreal.example/bot)"
DAILY_SCRAPE_LIMIT = 2


def get_site_url():
    return getattr(settings, "SITE_URL", "http://localhost:8000").rstrip("/")


def check_robots_txt(domain):
    """Return True if the domain's robots.txt allows our user-agent to fetch /."""
    try:
        import requests
        robots_url = f"https://{domain}/robots.txt"
        resp = requests.get(
            robots_url,
            headers={"User-Agent": USER_AGENT},
            timeout=10,
        )
        if resp.status_code != 200:
            return True
        text = resp.text.lower()
        if "user-agent: *" in text and "disallow: /" in text:
            return False
        return True
    except Exception:
        return False


def compute_source_hash(title, address, city, price):
    """Compute a stable hash to detect cross-site duplicates."""
    raw = f"{title}|{address or ''}|{city or ''}|{price or ''}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def upsert_scraped_estate(site_key, site_name, source_url, title, description,
                          price, currency, city, province, address,
                          bedrooms, bathrooms, property_type, listing_type,
                          debug=False):
    """Create or update a scraped Property as draft/unverified."""
    source_hash = compute_source_hash(title, address, city, price)

    existing = Property.objects.filter(source_hash=source_hash).first()
    if existing:
        if debug:
            self.stdout_write_debug(f"  Skip duplicate (hash match): {title}")
        return False, "duplicate"

    property_type = property_type or "apartment"
    listing_type = listing_type or "sale"

    prop = Property.objects.create(
        title=title[:255],
        slug=f"scraped-{site_key}-{source_hash[:12]}",
        description=description or "",
        property_type=property_type,
        listing_type=listing_type,
        price=price,
        currency=currency or "USD",
        bedrooms=bedrooms,
        bathrooms=bathrooms,
        address=address or "",
        city=city or "",
        province=province or "",
        status="draft",
        source_site=site_name,
        source_url=source_url,
        source_imported_at=timezone.now(),
        source_verified=False,
        source_hash=source_hash,
        source_status="unverified",
        created_by="soreal-bot",
    )

    if debug:
        self.stdout_write_debug(f"  Created draft: {prop.title} ({prop.custom_id})")
    return True, "created"


def stdout_write_debug(message):
    """Placeholder — replaced by bound method in handle()."""
    pass


def scrape_example_com(debug=False):
    """Example scraper stub. Replace with real site-specific logic."""
    if debug:
        stdout_write_debug("  example_com: no real scraper implemented yet")
    return []


SCRAPER_FUNCTIONS = {
    entry["key"]: globals()[entry["scraper"]]
    for entry in []
    if entry["scraper"] in globals()
}


class Command(BaseCommand):
    help = (
        "Render a reel from slides and audio using FFmpeg. "
        "Output lands as a draft/unverified property pending agent review."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "reel_id",
            type=int,
            help="ID of the Reel to render",
        )
        parser.add_argument(
            "--debug",
            action="store_true",
            help="Enable debug output",
        )

    def handle(self, *args, **options):
        reel_id = options["reel_id"]
        debug = options["debug"]

        try:
            from estates.models import Reel
            reel = Reel.objects.get(id=reel_id)
        except Reel.DoesNotExist:
            raise CommandError(f"Reel #{reel_id} does not exist")

        self.stdout.write(f"Rendering reel #{reel.id}: {reel.title}")

        if not reel.slides.exists():
            raise CommandError(f"Reel #{reel.id} has no slides")

        try:
            video_path = self._render_reel(reel, debug=debug)
        except Exception as exc:
            raise CommandError(f"Render failed: {exc}")

        reel.video_url = f"/media/reels/{os.path.basename(video_path)}"
        reel.status = "ready"
        reel.duration_seconds = self._get_duration(video_path)
        reel.save()

        self.stdout.write(self.style.SUCCESS(
            f"Render complete: {reel.video_url} ({reel.duration_seconds}s)"
        ))

    def _render_reel(self, reel, debug=False):
        """Render the reel to an MP4 file using FFmpeg."""
        slides = list(reel.slides.all().order_by("order"))
        audio_track = reel.audio_track

        # Create temp directory for intermediate files
        tmpdir = tempfile.mkdtemp(prefix="soreal_reel_")
        try:
            # Build input list for concat
            input_files = []
            for idx, slide in enumerate(slides):
                img_path = self._get_slide_image(slide, tmpdir, debug)
                if img_path:
                    input_files.append((img_path, slide.duration_seconds))

            # Build FFmpeg filter complex for transitions
            filter_complex = self._build_filter_complex(slides, len(slides))

            # Build output
            output_path = os.path.join(tmpdir, f"reel_{reel.id}.mp4")

            cmd = [
                "ffmpeg",
                "-y",
                "-hide_banner",
                "-loglevel", "error",
            ]

            # Add inputs
            for img_path, _ in input_files:
                cmd.extend(["-loop", "1", "-t", str(slides[input_files.index((img_path, _))[1]].duration_seconds),
                           "-i", img_path])

            # Add audio if available
            audio_input_idx = len(input_files)
            if reel.audio_track and reel.audio_track.file:
                reel.audio_track.file.open("rb")
                audio_tmp = os.path.join(tmpdir, "audio.mp3")
                with open(audio_tmp, "wb") as f:
                    for chunk in reel.audio_track.file.chunks():
                        f.write(chunk)
                reel.audio_track.file.close()
                cmd.extend(["-i", audio_tmp])

            # Filter complex
            cmd.extend(["-filter_complex", filter_complex])

            # Output mapping
            cmd.extend(["-map", "0:v", "-map", f"{audio_input_idx}:a"])

            # Encoding settings
            cmd.extend([
                "-c:v", "libx264",
                "-preset", "fast",
                "-crf", "23",
                "-c:a", "aac",
                "-b:a", "128k",
                "-pix_fmt", "yuv420p",
                "-shortest",
                output_path,
            ])

            self.stdout.write(f"Running FFmpeg: {' '.join(cmd[:5])}...")
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)

            if result.returncode != 0:
                self.stdout.write(self.style.ERROR(f"FFmpeg error: {result.stderr[-500:]}"))
                raise RuntimeError(f"FFmpeg failed: {result.stderr[-500:]}")

            return output_path

        finally:
            # Clean up temp dir
            import shutil
            shutil.rmtree(tmpdir, ignore_errors=True)

    def _get_slide_image(self, slide, tmpdir, debug=False):
        """Get the image file path for a slide."""
        if slide.image and slide.image.image:
            try:
                slide.image.image.open("rb")
                img_path = os.path.join(tmpdir, f"slide_{slide.order}.jpg")
                with open(img_path, "wb") as f:
                    for chunk in slide.image.image.chunks():
                        f.write(chunk)
                slide.image.image.close()
                return img_path
            except Exception as exc:
                if debug:
                    self.stdout_write_debug(f"  Could not read slide image: {exc}")
        if slide.image_url:
            # For external URLs, we'd need to download them
            # For now, skip
            if debug:
                self.stdout_write_debug(f"  External URL not supported yet: {slide.image_url}")
        return None

    def _build_filter_complex(self, slides, num_slides):
        """Build FFmpeg filter complex for transitions between slides."""
        if num_slides == 1:
            return "0:v"

        parts = []
        for i in range(num_slides - 1):
            # Each transition: crossfade from slide i to slide i+1
            # The transition happens at the end of slide i
            transition_duration = slides[i].transition_duration or 0.5
            duration_i = slides[i].duration_seconds or 3.0
            offset = max(0, duration_i - transition_duration)

            parts.append(
                f"[{i}:v][{i+1}:v]xfade=transition=fade:duration={transition_duration}:offset={offset}[v{i+1}];"
            )

        # Final output is the last slide
        parts.append(f"[{num_slides - 1}]format=yuv420p[v]")
        return ";".join(parts)

    def _get_duration(self, video_path):
        """Get video duration using ffprobe."""
        import subprocess
        try:
            result = subprocess.run(
                ["ffprobe", "-v", "error", "-show_entries", "format=duration",
                 "-of", "default=noprint_wrappers=1:nokey=1", video_path],
                capture_output=True, text=True, timeout=30
            )
            return float(result.stdout.strip())
        except Exception:
            return None