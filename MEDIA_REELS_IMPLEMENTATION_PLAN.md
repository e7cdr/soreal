# Media / Reels Implementation Plan

This document summarizes all media/reels features implemented across Phases 10–15
for the SOREAL real-estate platform. Earlier work (Marketing Phases 1–9,
blacklist, analytics, etc.) was completed in prior sessions.

---

## Phase 10 — Media Foundation (Backend)

**Objective:** Add core data models, serializers, viewsets, API routes, audio
analysis, and FFmpeg-based reel rendering.

### Models Added (`Backend/estates/models.py`)
| Model | Purpose |
|-------|---------|
| `AudioTrack` | Uploaded soundtrack with BPM, key, waveform peaks, spectral bands, song sections |
| `Reel` | Short-form video reel project (estate photos + audio) |
| `ReelSlide` | Single slide within a reel (image + text overlay + transitions) |
| `ReelTemplate` | Pre-built reel blueprint (genre + target BPM range) |

### Serializers Added (`Backend/estates/serializers.py`)
- `AudioTrackSerializer`
- `ReelSerializer` (with nested `ReelSlideSerializer`)
- `ReelSlideSerializer`
- `ReelTemplateSerializer`

### Viewsets Added (`Backend/estates/viewsets.py`)
- `AudioTrackViewSet` — staff-managed audio tracks
- `ReelViewSet` — staff-managed reel projects
- `ReelSlideViewSet` — staff-managed reel slides
- `ReelTemplateViewSet` — read-only templates

### API Routes Registered (`Backend/estates/api_urls.py`)
- `/api/estates/audio-tracks/`
- `/api/estates/reels/`
- `/api/estates/reel-slides/`
- `/api/estates/reel-templates/`

### Audio Analysis Module (`Backend/estates/audio_analysis.py`)
Ported from MixMate's `services.py`. Provides:
- BPM detection (onset-based with phase verification)
- Musical key detection (Krumhansl-Kessler chromagram correlation)
- Spectral analysis (bands, centroid, rolloff, flatness)
- Waveform peak extraction
- Time-domain analysis per window
- Phase correlation & stereo width
- Loudness approximation (LUFS-ish)

### Management Commands
- `analyze_audio` — Analyze an uploaded audio track (BPM, key, waveform, bands)
- `render_reel` — FFmpeg-based reel renderer with crossfade transitions

### Migration
- `0022_audiotrack_reeltemplate_reel_reelslide.py`

---

## Phase 11 — Reel Builder Frontend

**Objective:** Build the frontend UI for managing reels, audio tracks, and templates.

### New Pages
| Page | Route | Purpose |
|------|-------|---------|
| Reel Library | `/media/reels` | CRUD list with status/aspect filters, quick stats, render action |
| Reel Detail | `/media/reels/[id]` | Video preview, slides list, audio/estate info, copy video URL |
| Reel Editor | `/media/reels/[id]/edit` | Add/edit/delete/reorder slides |
| Audio Tracks | `/media/audio` | Upload/manage audio tracks with waveform preview |
| Templates | `/media/templates` | Reel template gallery |

### Navigation
Added links: `/media/reels`, `/media/audio`, `/media/templates` with `Video`, `Play`, `FileText` icons.

### API Functions Added (`Frontend/soreal/lib/api.js`)
- Audio tracks: `fetchAudioTracks`, `createAudioTrack`, `updateAudioTrack`, `deleteAudioTrack`
- Reels: `fetchReels`, `fetchReel`, `createReel`, `updateReel`, `deleteReel`
- Slides: `fetchReelSlides`, `createReelSlide`, `updateReelSlide`, `deleteReelSlide`
- Templates: `fetchReelTemplates`

### i18n Keys
Added EN/ES translations for all media/reels UI elements.

---

## Phase 12 — Motion Graphics & Typography

**Objective:** Enhance the slide editor with rich typography and motion controls.

### Model Enhancements (`ReelSlide`)
Added fields:
- `text_font_family` (sans-serif, serif, monospace, script, display)
- `text_color` (white, black, yellow, gold, red, blue, green, custom)
- `text_custom_color` (hex)
- `text_background` (boolean)
- `text_background_opacity` (0.0–1.0)
- `text_animation` (none, fade-in, slide-up, slide-down, bounce, zoom-in, typewriter)
- `text_animation_duration`
- `text_shadow`
- `lower_third` (auto-populate from estate details)
- Expanded `text_position` choices (center, top, bottom, top-left, top-right, bottom-left, bottom-right, lower-third)

### Serializer & Migration
- `ReelSlideSerializer` updated with all new fields
- Migration `0023_reelslide_lower_third_reelslide_text_animation_and_more.py`

### Frontend Editor Enhancements
- Typography presets (Title, Subtitle, Caption, Lower Third, Custom)
- Font family selector
- Text color picker (presets + custom hex input)
- Text background toggle + opacity slider
- Text shadow toggle
- Text animation selector + duration
- Lower third toggle with estate info auto-population
- Beat sync offset control
- Live text preview with applied styles

---

## Phase 13 — Audio & BPM Sync

**Objective:** Auto-detect audio properties and sync reel slides to beats.

### Backend
- `AudioTrackViewSet.analyze` action (POST `/api/estates/audio-tracks/{id}/analyze/`) — runs MixMate-style DSP analysis
- `ReelViewSet.beat_sync_slides` action (POST `/api/estates/reels/{id}/beat_sync_slides/`) — auto-generates BPM-synced slides
- `audio_track_key` added to `ReelSerializer`

### Frontend
- Audio page: Analyze button per track, BPM/key display on cards, analyzing state spinner
- Reel editor: Beat Sync button auto-generates slides from BPM; disabled when no BPM available

### API Functions
- `analyzeAudioTrack`
- `beatSyncSlides`

---

## Phase 14 — Distribution Pipeline

**Objective:** Publish rendered reels to social platforms and share/download.

### Model Enhancements (`Reel`)
Added fields:
- `publish_status` (unpublished, published, publish_failed)
- `published_at`
- `platforms_published` (JSON list)
- `download_count`

### Backend
- `ReelViewSet.publish_reel` action (POST `/api/estates/reels/{id}/publish_reel/`) — publish to WhatsApp/Facebook/Instagram/TikTok

### Frontend Reel Detail Page
- Distribution section with publish status badge
- Publish buttons per platform
- Quick share: WhatsApp, Facebook, copy link, download MP4

### API Function
- `publishReel`

---

## Phase 15 — Advanced Automation

**Objective:** Template-based reel creation and batch rendering.

### Backend
- `ReelTemplateViewSet.use_template` action (POST `/api/estates/reel-templates/{id}/use_template/`) — creates a Reel from a template with auto-populated slides
- `ReelViewSet.batch_render` action (POST `/api/estates/reels/batch_render/`) — queues multiple draft reels for rendering

### Frontend
- Templates page: "Use Template" dialog with title input; auto-creates reel and navigates to editor
- Reel library: checkbox selection per reel, Select All toggle, Batch Render button for selected draft reels, selection count badge

### API Functions
- `createReelFromTemplate`
- `batchRenderReels`

---

## Additional Fixes During This Session

### `next.config.mjs` Fix
Removed the unrecognized `sitemaps` config key that caused a build warning. The Django backend already serves `/sitemap.xml` and `/robots.txt` (from Marketing Phase 2).

### `/health` Endpoint
Added `health_check` view returning `200 OK` with JSON status (including database connectivity check) for uptime monitoring. Routes: `/health` and `/health/`.

---

## Verification Summary

| Check | Result |
|-------|--------|
| Django `manage.py check` | ✅ Passes (0 issues) |
| Backend tests | ✅ 74 tests pass |
| `next build` | ✅ Passes (29 routes, no config warnings) |
| `npm run lint` | ✅ 0 errors (22 pre-existing non-blocking warnings) |

### Total Routes (Frontend): 29
Includes all media/reels routes:
- `/media/reels`, `/media/reels/[id]`, `/media/reels/[id]/edit`
- `/media/audio`, `/media/templates`

---

## Git History (This Session)

| Commit | Description |
|--------|-------------|
| `1f0edc1` | Phase 10: Media foundation (backend) |
| `66aa5f9` | Phase 11: Reel builder frontend |
| `c31aba4` | Phase 12: Motion graphics & typography |
| `dc03c55` | Phase 13: Audio & BPM sync |
| `c4f41a1` | Phase 14: Distribution pipeline |
| `ef541f0` | Phase 15: Advanced automation |
| `dd4cc1e` | Fix invalid sitemaps key in next.config.mjs |
| `e08bd32` | Add /health endpoint for uptime monitoring |

All commits pushed to `master` on `https://github.com/e7cdr/soreal.git`.

---

## Remaining Work

The media/reels feature set is now complete (Phases 10–15). Potential future enhancements not yet implemented:

- Celery background jobs for async reel rendering (currently synchronous via management command)
- NDJSON streaming of render progress to frontend
- Reference fingerprint library for audio matching
- Automatic reel population from estate data (beyond manual template selection)
- Scheduled/auto publishing to social platforms via their APIs