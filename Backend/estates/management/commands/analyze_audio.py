"""
Analyze an uploaded audio track using MixMate-style DSP.

Computes BPM, key, spectral bands, loudness, phase correlation,
waveform peaks, and time-domain analysis. Results are stored on
the AudioTrack model for use by the reel builder.
"""

from django.core.management.base import BaseCommand, CommandError
from django.conf import settings

from estates.models import AudioTrack
from estates.audio_analysis import analyze


class Command(BaseCommand):
    help = "Analyze an audio track: BPM, key, spectral bands, waveform, etc."

    def add_arguments(self, parser):
        parser.add_argument(
            "audio_track_id",
            type=int,
            help="ID of the AudioTrack to analyze",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Parse and report what would be analyzed without saving",
        )

    def handle(self, *args, **options):
        track_id = options["audio_track_id"]
        dry_run = options["dry_run"]

        try:
            track = AudioTrack.objects.get(id=track_id)
        except AudioTrack.DoesNotExist:
            raise CommandError(f"AudioTrack #{track_id} does not exist")

        if not track.file:
            raise CommandError(f"AudioTrack #{track_id} has no file")

        self.stdout.write(f"Analyzing audio track #{track_id}: {track.file.name}")

        if dry_run:
            self.stdout.write("[DRY-RUN] Would analyze audio track")
            return

        try:
            # Open the file and analyze
            track.file.open("rb")
            result = analyze(track.file, track.file.name)
            track.file.close()
        except Exception as exc:
            self.stdout.write(self.style.ERROR(f"Analysis failed: {exc}"))
            return

        # Store results
        track.bpm = result.get("bpm")
        track.key = result.get("key")
        track.duration_seconds = result.get("duration_seconds")
        track.waveform_peaks = result.get("waveform", [])
        track.spectral_bands = result.get("bands", [])
        track.sections = result.get("timeline", [])
        track.save()

        self.stdout.write(self.style.SUCCESS(
            f"Analysis complete: BPM={track.bpm}, key={track.key}, "
            f"duration={track.duration_seconds}s, "
            f"{len(track.waveform_peaks)} waveform points, "
            f"{len(track.spectral_bands)} bands, "
            f"{len(track.sections)} sections"
        ))