"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Play,
  Edit3,
  Trash2,
  Download,
  RefreshCw,
  X,
  Video,
  Music,
  Image,
  LayoutGrid,
  Share2,
  Send,
  Phone,
} from "lucide-react";
import { useTranslation } from "@/app/components/LanguageProvider";
import PageShell from "@/app/components/PageShell";
import {
  fetchReel,
  updateReel,
  deleteReel,
  fetchReelSlides,
  publishReel,
} from "@/lib/api";

const STATUS_LABELS = {
  draft: "Draft",
  rendering: "Rendering",
  ready: "Ready",
  failed: "Failed",
};

const STATUS_COLORS = {
  draft: "bg-[var(--surface-muted)] text-[var(--text-muted)]",
  rendering: "bg-amber-100 text-amber-700",
  ready: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
};

export default function ReelDetailPage({ params }) {
  const reelId = Number(params.id);
  const { translate: t } = useTranslation();
  const [reel, setReel] = useState(null);
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [publishing, setPublishing] = useState({});

  const fetchReelDetail = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [reelData, slidesData] = await Promise.all([
        fetchReel(reelId),
        fetchReelSlides({ reel: reelId }),
      ]);
      setReel(reelData);
      setSlides(slidesData.results || slidesData || []);
    } catch (err) {
      setError(err.message || t("error"));
    } finally {
      setLoading(false);
    }
  }, [reelId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchReelDetail();
  }, [fetchReelDetail]);

  const handleDelete = async () => {
    if (!window.confirm(t("confirmDeleteReel"))) return;
    setDeleting(true);
    try {
      await deleteReel(reelId);
      window.location.href = "/media/reels";
    } catch (err) {
      setError(err.message || t("error"));
    } finally {
      setDeleting(false);
    }
  };

  const handlePublish = async (platform) => {
    setPublishing((prev) => ({ ...prev, [platform]: true }));
    try {
      await publishReel(reelId, platform);
      await fetchReelDetail();
    } catch (err) {
      setError(err.message || t("error"));
    } finally {
      setPublishing((prev) => ({ ...prev, [platform]: false }));
    }
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(
      `${reel.title || t("untitledReel")} ${reel.video_url || ""}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const shareFacebook = () => {
    const url = encodeURIComponent(reel.video_url || window.location.href);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, "_blank");
  };

  const copyLink = () => {
    navigator.clipboard.writeText(reel.video_url || window.location.href);
    // eslint-disable-next-line no-alert
    alert(t("linkCopied"));
  };

  const handleRender = async () => {
    try {
      await updateReel(reelId, { status: "rendering" });
      await fetchReelDetail();
    } catch (err) {
      setError(err.message || t("error"));
    }
  };

  const copyVideoUrl = () => {
    if (!reel?.video_url) return;
    navigator.clipboard.writeText(reel.video_url);
    // eslint-disable-next-line no-alert
    alert(t("videoUrlCopied"));
  };

  const formatDuration = (seconds) => {
    if (seconds == null) return "-";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <PageShell
        eyebrow={t("reelLibrary")}
        title={t("loadingReel")}
      >
        <div className="h-64 flex items-center justify-center text-[var(--text-muted)]">
          {t("loadingReel")}
        </div>
      </PageShell>
    );
  }

  if (error || !reel) {
    return (
      <PageShell
        eyebrow={t("reelLibrary")}
        title={t("reelNotFound")}
      >
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--text-muted)]">
          {error || t("reelNotFoundDescription")}
          <div className="mt-4">
            <Link href="/media/reels" className="text-[var(--green)] hover:underline">
              {t("backToReelLibrary")}
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      eyebrow={t("reelLibrary")}
      title={reel.title || t("untitledReel")}
      description={reel.description || undefined}
      actions={
        <>
          <Link href="/media/reels" className="toolbar-button">
            <Video size={16} />
            {t("backToReelLibrary")}
          </Link>
          <button
            type="button"
            onClick={() => {
              window.location.href = `/media/reels/${reelId}/edit`;
            }}
            className="toolbar-button toolbar-button-primary"
          >
            <Edit3 size={16} />
            {t("editReel")}
          </button>
        </>
      }
    >
      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Reel preview / hero */}
      <div className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
        <div className="relative aspect-video rounded-lg border border-[var(--border)] bg-black overflow-hidden mb-3">
          {reel.video_url ? (
            <>
              <video
                autoPlay
                muted
                loop
                playsInline
                className="w-full h-full object-cover"
                poster={reel.thumbnail_url || undefined}
              >
                <source src={reel.video_url} type="video/mp4" />
              </video>
              {reel.status === "ready" && (
                <button
                  type="button"
                  className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/20 transition"
                  onClick={(e) => {
                    e.stopPropagation();
                    const v = e.currentTarget.parentElement.querySelector("video");
                    if (v.paused) v.play(); else v.pause();
                  }}
                >
                  <Play size={48} className="text-white drop-shadow-lg" />
                </button>
              )}
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-[var(--text-muted-light)]">
              <Video size={48} className="mb-2 opacity-50" />
              <p className="text-sm">{reel.status === "ready" ? t("noVideoRendered") : t("renderToPreview")}</p>
              {reel.status !== "ready" && (
                <button
                  type="button"
                  onClick={handleRender}
                  disabled={reel.status === "rendering"}
                  className="mt-2 toolbar-button toolbar-button-primary disabled:opacity-50"
                >
                  {reel.status === "rendering" ? t("rendering") : t("renderReelNow")}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--surface-muted)]">
            <Music size={20} className="text-[var(--text-muted)]" />
            <div>
              <p className="text-xs text-[var(--text-muted)]">{t("bpm")}</p>
              <p className="text-sm font-semibold">{reel.bpm ? `${reel.bpm} BPM` : t("notDetected")}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--surface-muted)]">
            <Image size={20} className="text-[var(--text-muted)]" />
            <div>
              <p className="text-xs text-[var(--text-muted)]">{t("aspectRatio")}</p>
              <p className="text-sm font-semibold">{reel.aspect_ratio}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--surface-muted)]">
            <LayoutGrid size={20} className="text-[var(--text-muted)]" />
            <div>
              <p className="text-xs text-[var(--text-muted)]">{t("reelSlides")}</p>
              <p className="text-sm font-semibold">{slides.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--surface-muted)]">
            <Download size={20} className="text-[var(--text-muted)]" />
            <div>
              <p className="text-xs text-[var(--text-muted)]">{t("duration")}</p>
              <p className="text-sm font-semibold">{formatDuration(reel.duration_seconds)}</p>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${STATUS_COLORS[reel.status]}`}>
            {STATUS_LABELS[reel.status] || reel.status}
          </span>
          <div className="flex items-center gap-2">
            {reel.status === "draft" && (
              <button
                type="button"
                onClick={handleRender}
                className="p-1.5 bg-amber-50 text-amber-600 rounded hover:bg-amber-100"
                title={t("renderReel")}
              >
                <Play size={14} />
              </button>
            )}
            {reel.video_url && (
              <button
                type="button"
                onClick={copyVideoUrl}
                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--green)]"
                title={t("copyVideoUrl")}
              >
                <Download size={14} />
              </button>
            )}
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="p-1.5 text-[var(--text-muted)] hover:text-red-600 disabled:opacity-50"
              title={t("deleteReel")}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {reel.video_url && (
          <div className="mt-3 flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <span>🔗 {reel.video_url}</span>
            <button
              type="button"
              onClick={copyVideoUrl}
              className="text-[var(--green)] hover:underline"
            >
              {t("copyVideoUrl")}
            </button>
          </div>
        )}
      </div>

      {/* Slides */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">{t("reelSlides")} ({slides.length})</h2>
          <Link
            href={`/media/reels/${reelId}/edit`}
            className="text-xs text-[var(--green)] hover:underline"
          >
            {t("manageSlides")}
          </Link>
        </div>

        {slides.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-muted)] text-center text-sm text-[var(--text-muted)]">
            <Image size={24} className="mb-2 text-[var(--text-muted-light)]" />
            <p>{t("noSlidesYet")}</p>
            <Link
              href={`/media/reels/${reelId}/edit`}
              className="mt-2 text-[var(--green)] hover:underline"
            >
              {t("addFirstSlide")}
            </Link>
          </div>
        ) : (
          <div className="grid gap-2 max-h-[400px] overflow-y-auto">
            {slides.map((slide) => (
              <div
                key={slide.id}
                className="flex items-center gap-3 p-2 rounded-lg border border-[var(--border)] bg-[var(--surface-surface)]"
              >
                <span className="w-6 text-center text-xs font-semibold text-[var(--text-muted)]">
                  {slide.order}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[var(--text-muted)] text-xs">{slide.transition_type}</span>
                    <span className="text-[var(--text-muted)] text-xs">· {slide.duration_seconds}s</span>
                  </div>
                  <p className="text-sm text-[var(--foreground)] truncate">
                    {slide.text_overlay || t("noTextOverlay")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Audio */}
      {reel.audio_track && (
        <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Music size={20} className="text-[var(--text-muted)]" />
            {t("audioTrack")}
          </h2>
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{reel.audio_track_title || t("untitledAudio")}</p>
              <p className="text-xs text-[var(--text-muted)]">
                {reel.bpm ? `${reel.bpm} BPM` : "-"} · {t("key")}: {reel.audio_track_key || t("notDetected")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Estate */}
      {reel.estate && (
        <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
          <h2 className="text-lg font-semibold mb-3">
            🏠 {t("estate")}
          </h2>
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{reel.estate_title || t("untitledEstate")}</p>
              {reel.estate_slug && (
                <p className="text-xs text-[var(--text-muted)] truncate">
                  {t("estateSlug")}: {reel.estate_slug}
                </p>
              )}
            </div>
            <Link
              href={`/estates/${reel.estate_slug}`}
              className="text-xs text-[var(--green)] hover:underline"
            >
              {t("viewEstate")}
            </Link>
          </div>
        </div>
      )}

      {/* Distribution */}
      {reel.video_url && (
        <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Share2 size={20} className="text-[var(--text-muted)]" />
            {t("distribution")}
          </h2>

          {/* Publish status */}
          <div className="mb-4">
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded ${
                reel.publish_status === "published"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-[var(--surface-muted)] text-[var(--text-muted)]"
              }`}
            >
              {reel.publish_status === "published"
                ? t("published")
                : t("unpublished")}
            </span>
            {reel.platforms_published.length > 0 && (
              <span className="ml-2 text-xs text-[var(--text-muted)]">
                {t("publishedTo")}: {reel.platforms_published.join(", ")}
              </span>
            )}
            {reel.published_at && (
              <span className="ml-2 text-xs text-[var(--text-muted)]">
                {t("publishedAt")}:{" "}
                {new Date(reel.published_at).toLocaleDateString()}
              </span>
            )}
          </div>

          {/* Publish buttons */}
          <div className="grid gap-2 md:grid-cols-2 mb-4">
            <button
              type="button"
              onClick={() => handlePublish("whatsapp")}
              disabled={publishing.whatsapp}
              className={`w-full p-2.5 rounded-lg border flex items-center justify-center gap-2 text-sm font-medium transition ${
                reel.platforms_published.includes("whatsapp")
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-[var(--surface)] border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
              }`}
            >
              {publishing.whatsapp ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <Phone size={14} />
              )}
              {reel.platforms_published.includes("whatsapp")
                ? t("publishedOnWhatsApp")
                : t("publishToWhatsApp")}
            </button>
            <button
              type="button"
              onClick={() => handlePublish("facebook")}
              disabled={publishing.facebook}
              className={`w-full p-2.5 rounded-lg border flex items-center justify-center gap-2 text-sm font-medium transition ${
                reel.platforms_published.includes("facebook")
                  ? "bg-blue-50 text-blue-700 border-blue-200"
                  : "bg-[var(--surface)] border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
              }`}
            >
              {publishing.facebook ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <Share2 size={14} />
              )}
              {reel.platforms_published.includes("facebook")
                ? t("publishedOnFacebook")
                : t("publishToFacebook")}
            </button>
            <button
              type="button"
              onClick={() => handlePublish("instagram")}
              disabled={publishing.instagram}
              className={`w-full p-2.5 rounded-lg border flex items-center justify-center gap-2 text-sm font-medium transition ${
                reel.platforms_published.includes("instagram")
                  ? "bg-purple-50 text-purple-700 border-purple-200"
                  : "bg-[var(--surface)] border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
              }`}
            >
              {publishing.instagram ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <Share2 size={14} />
              )}
              {reel.platforms_published.includes("instagram")
                ? t("publishedOnInstagram")
                : t("publishToInstagram")}
            </button>
            <button
              type="button"
              onClick={() => handlePublish("tiktok")}
              disabled={publishing.tiktok}
              className={`w-full p-2.5 rounded-lg border flex items-center justify-center gap-2 text-sm font-medium transition ${
                reel.platforms_published.includes("tiktok")
                  ? "bg-cyan-50 text-cyan-700 border-cyan-200"
                  : "bg-[var(--surface)] border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
              }`}
            >
              {publishing.tiktok ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <Link size={14} />
              )}
              {reel.platforms_published.includes("tiktok")
                ? t("publishedOnTikTok")
                : t("publishToTikTok")}
            </button>
          </div>

          {/* Quick share actions */}
          <div className="grid gap-2 md:grid-cols-4">
            <button
              type="button"
              onClick={shareWhatsApp}
              className="p-2.5 rounded-lg bg-green-50 text-green-700 border border-green-200 text-sm font-medium hover:bg-green-100 transition"
            >
              <Send size={16} className="mr-1.5" />
              {t("shareWhatsApp")}
            </button>
            <button
              type="button"
              onClick={shareFacebook}
              className="p-2.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-sm font-medium hover:bg-blue-100 transition"
            >
              <Share2 size={16} className="mr-1.5" />
              {t("shareFacebook")}
            </button>
            <button
              type="button"
              onClick={copyLink}
              className="p-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition"
            >
              <Link size={16} className="mr-1.5" />
              {t("copyLink")}
            </button>
            <button
              type="button"
              onClick={() => {
                if (reel.video_url) window.open(reel.video_url, "_blank");
              }}
              className="p-2.5 rounded-lg bg-[var(--surface-muted)] border border-[var(--border)] text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--surface-hover)] transition"
            >
              <Download size={16} className="mr-1.5" />
              {t("downloadReel")}
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 text-xs text-[var(--text-muted)]">
        <p>
          <strong>{t("createdBy")}:</strong> {reel.created_by || "-"} &nbsp;|&nbsp;
          <strong>{t("createdAt")}:</strong> {new Date(reel.created_at).toLocaleDateString()}
        </p>
        {reel.updated_at && (
          <p>
            <strong>{t("updatedAt")}:</strong> {new Date(reel.updated_at).toLocaleDateString()}
          </p>
        )}
      </div>
    </PageShell>
  );
}
