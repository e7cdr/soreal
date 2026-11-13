"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Trash2,
  Edit3,
  X,
  RefreshCw,
  MoveVertical,
  Image as ImageIcon,
  Text as TextIcon,
  Play,
} from "lucide-react";
import { useTranslation } from "@/app/components/LanguageProvider";
import PageShell from "@/app/components/PageShell";
import {
  fetchReel,
  updateReel,
  fetchReelSlides,
  createReelSlide,
  updateReelSlide,
  deleteReelSlide,
} from "@/lib/api";

const TRANSITION_LABELS = {
  fade: "Fade",
  "slide-left": "Slide Left",
  "slide-right": "Slide Right",
  "zoom-in": "Zoom In",
  cut: "Hard Cut",
  glitch: "Glitch",
};

const POSITION_LABELS = {
  center: "Center",
  top: "Top",
  bottom: "Bottom",
};

export default function ReelEditPage({ params }) {
  const reelId = Number(params.id);
  const { translate: t } = useTranslation();
  const [reel, setReel] = useState(null);
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openSlideForm, setOpenSlideForm] = useState(false);
  const [editingSlideId, setEditingSlideId] = useState(null);
  const [slideForm, setSlideForm] = useState({
    image: "",
    image_url: "",
    duration_seconds: 3,
    transition_type: "fade",
    transition_duration: 0.5,
    text_overlay: "",
    text_position: "center",
    text_font_scale: 1,
    beat_offset: 0,
    order: 0,
  });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const fetchReelDetail = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [reelData, slidesData] = await Promise.all([
        fetchReel(reelId),
        fetchReelSlides({ reel: reelId }),
      ]);
      setReel(reelData);
      setSlides((slidesData.results || slidesData || []).sort((a, b) => a.order - b.order));
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

  const handleAddSlide = () => {
    setEditingSlideId(null);
    setSlideForm({
      image: "",
      image_url: "",
      duration_seconds: 3,
      transition_type: "fade",
      transition_duration: 0.5,
      text_overlay: "",
      text_position: "center",
      text_font_scale: 1,
      beat_offset: 0,
      order: slides.length,
    });
    setOpenSlideForm(true);
  };

  const handleEditSlide = (slide) => {
    setEditingSlideId(slide.id);
    setSlideForm({
      image: slide.image || "",
      image_url: slide.image_url || "",
      duration_seconds: slide.duration_seconds,
      transition_type: slide.transition_type,
      transition_duration: slide.transition_duration,
      text_overlay: slide.text_overlay || "",
      text_position: slide.text_position || "center",
      text_font_scale: slide.text_font_scale || 1,
      beat_offset: slide.beat_offset || 0,
      order: slide.order,
    });
    setOpenSlideForm(true);
  };

  const handleSubmitSlide = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        reel: reelId,
        ...slideForm,
        duration_seconds: Number(slideForm.duration_seconds),
        transition_duration: Number(slideForm.transition_duration),
        text_font_scale: Number(slideForm.text_font_scale),
        beat_offset: Number(slideForm.beat_offset),
        order: Number(slideForm.order),
      };
      if (editingSlideId) {
        await updateReelSlide(editingSlideId, payload);
      } else {
        await createReelSlide(payload);
      }
      setOpenSlideForm(false);
      setEditingSlideId(null);
      await fetchReelDetail();
    } catch (err) {
      setError(err.message || t("error"));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSlide = async (id) => {
    setDeletingId(id);
    try {
      await deleteReelSlide(id);
      await fetchReelDetail();
    } catch (err) {
      setError(err.message || t("error"));
    } finally {
      setDeletingId(null);
    }
  };

  const handleMoveUp = (index) => {
    if (index === 0) return;
    const newSlides = [...slides];
    [newSlides[index - 1], newSlides[index]] = [newSlides[index], newSlides[index - 1]];
    newSlides[index - 1].order = index - 1;
    newSlides[index].order = index;
    setSlides(newSlides);
    // Persist order changes
    Promise.all(
      newSlides.map((s, i) =>
        updateReelSlide(s.id, { order: i }).catch(() => {})
      )
    ).then(() => fetchReelDetail());
  };

  const handleMoveDown = (index) => {
    if (index === slides.length - 1) return;
    const newSlides = [...slides];
    [newSlides[index], newSlides[index + 1]] = [newSlides[index + 1], newSlides[index]];
    newSlides[index].order = index;
    newSlides[index + 1].order = index + 1;
    setSlides(newSlides);
    Promise.all(
      newSlides.map((s, i) =>
        updateReelSlide(s.id, { order: i }).catch(() => {})
      )
    ).then(() => fetchReelDetail());
  };

  if (loading) {
    return (
      <PageShell eyebrow={t("reelLibrary")} title={t("loadingReel")}>
        <div className="h-64 flex items-center justify-center text-[var(--text-muted)]">
          {t("loadingReel")}
        </div>
      </PageShell>
    );
  }

  if (error || !reel) {
    return (
      <PageShell eyebrow={t("reelLibrary")} title={t("reelNotFound")}>
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
      title={`${reel.title || t("untitledReel")} — ${t("editReel")}`}
      description={t("editSlideDescription")}
      actions={
        <>
          <Link href={`/media/reels/${reelId}`} className="toolbar-button">
            <Play size={16} />
            {t("previewReel")}
          </Link>
          <Link href="/media/reels" className="toolbar-button">
            <X size={16} />
            {t("backToReelLibrary")}
          </Link>
          <button
            type="button"
            onClick={handleAddSlide}
            className="toolbar-button toolbar-button-primary"
          >
            <Plus size={16} />
            {t("addSlide")}
          </button>
        </>
      }
    >
      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Slides list */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">{t("reelSlides")} ({slides.length})</h2>
          <span className="text-xs text-[var(--text-muted)]">
            {t("dragToReorderHint")}
          </span>
        </div>

        {slides.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-muted)] text-center text-sm text-[var(--text-muted)]">
            <ImageIcon size={24} className="mb-2 text-[var(--text-muted-light)]" />
            <p>{t("noSlidesYet")}</p>
            <button
              type="button"
              onClick={handleAddSlide}
              className="mt-2 toolbar-button toolbar-button-primary"
            >
              {t("addFirstSlide")}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {slides.map((slide, index) => (
              <div
                key={slide.id}
                className="flex items-center gap-3 p-2 rounded-lg border border-[var(--border)] bg-[var(--surface-surface)]"
              >
                <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                  <MoveVertical size={14} className="cursor-grab" />
                  <button
                    type="button"
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    className="p-1 opacity-50 hover:opacity-100 disabled:cursor-not-allowed"
                    title={t("moveUp")}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveDown(index)}
                    disabled={index === slides.length - 1}
                    className="p-1 opacity-50 hover:opacity-100 disabled:cursor-not-allowed"
                    title={t("moveDown")}
                  >
                    ▼
                  </button>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[var(--text-muted)] text-xs px-1.5 py-0.5 rounded border border-[var(--border)]`}
                    >
                      {TRANSITION_LABELS[slide.transition_type] || slide.transition_type}
                    </span>
                    <span className="text-[var(--text-muted)] text-xs">
                      {slide.duration_seconds}s
                    </span>
                    {slide.beat_offset > 0 && (
                      <span className="text-[var(--text-muted)] text-xs">
                        • beat {slide.beat_offset}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--foreground)] truncate">
                    {slide.text_overlay || t("noTextOverlay")}
                  </p>
                </div>

                <div className="flex items-center gap-1 ml-2">
                  <button
                    type="button"
                    onClick={() => handleEditSlide(slide)}
                    className="p-1.5 text-[var(--text-muted)] hover:text-[var(--green)]"
                    title={t("editSlide")}
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteSlide(slide.id)}
                    disabled={deletingId === slide.id}
                    className="p-1.5 text-[var(--text-muted)] hover:text-red-600 disabled:opacity-50"
                    title={t("deleteSlide")}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Slide form modal */}
      {openSlideForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <form
            onSubmit={handleSubmitSlide}
            className="my-4 grid w-full max-w-2xl gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl sm:grid-cols-2"
          >
            <div className="flex items-center justify-between gap-3 sm:col-span-2">
              <h2 className="text-lg font-semibold">
                {editingSlideId ? t("editSlide") : t("addSlide")}
              </h2>
              <button
                type="button"
                onClick={() => setOpenSlideForm(false)}
                className="toolbar-button"
              >
                <X size={16} />
                {t("close")}
              </button>
            </div>

            <label className="sm:col-span-2">
              <span className="block text-sm font-medium text-[var(--foreground)] mb-1">
                {t("slideImage")}
              </span>
              <select
                name="image"
                value={slideForm.image}
                onChange={(event) => setSlideForm({ ...slideForm, image: event.target.value })}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
              >
                <option value="">{t("noImage")}</option>
              </select>
              <p className="text-[var(--text-muted)] text-xs mt-1">
                {t("selectImageFromGallery")}
              </p>
            </label>

            <label className="sm:col-span-2">
              <span className="block text-sm font-medium text-[var(--foreground)] mb-1">
                {t("slideImageUrl")}
              </span>
              <input
                type="url"
                name="image_url"
                value={slideForm.image_url}
                onChange={(event) => setSlideForm({ ...slideForm, image_url: event.target.value })}
                placeholder={t("imageUrlPlaceholder")}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-1">
                <span className="block text-sm font-medium text-[var(--foreground)] mb-1">
                  {t("slideDuration")}
                </span>
                <input
                  type="number"
                  name="duration_seconds"
                  min="1"
                  max="30"
                  step="0.5"
                  value={slideForm.duration_seconds}
                  onChange={(event) =>
                    setSlideForm({ ...slideForm, duration_seconds: event.target.value })
                  }
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
                />
              </label>
              <label className="sm:col-span-1">
                <span className="block text-sm font-medium text-[var(--foreground)] mb-1">
                  {t("slideTransition")}
                </span>
                <select
                  name="transition_type"
                  value={slideForm.transition_type}
                  onChange={(event) =>
                    setSlideForm({ ...slideForm, transition_type: event.target.value })
                  }
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
                >
                  {Object.entries(TRANSITION_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-1">
                <span className="block text-sm font-medium text-[var(--foreground)] mb-1">
                  {t("transitionDuration")}
                </span>
                <input
                  type="number"
                  name="transition_duration"
                  min="0"
                  max="5"
                  step="0.1"
                  value={slideForm.transition_duration}
                  onChange={(event) =>
                    setSlideForm({ ...slideForm, transition_duration: event.target.value })
                  }
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
                />
              </label>
              <label className="sm:col-span-1">
                <span className="block text-sm font-medium text-[var(--foreground)] mb-1">
                  {t("slideTextPosition")}
                </span>
                <select
                  name="text_position"
                  value={slideForm.text_position}
                  onChange={(event) =>
                    setSlideForm({ ...slideForm, text_position: event.target.value })
                  }
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
                >
                  {Object.entries(POSITION_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="sm:col-span-2">
              <span className="block text-sm font-medium text-[var(--foreground)] mb-1">
                {t("slideTextOverlay")}
              </span>
              <input
                type="text"
                name="text_overlay"
                value={slideForm.text_overlay}
                onChange={(event) => setSlideForm({ ...slideForm, text_overlay: event.target.value })}
                placeholder={t("textOverlayPlaceholder")}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
              />
            </label>

            <label className="sm:col-span-2">
              <span className="block text-sm font-medium text-[var(--foreground)] mb-1">
                {t("slideBeatOffset")}
              </span>
              <input
                type="number"
                name="beat_offset"
                value={slideForm.beat_offset}
                onChange={(event) => setSlideForm({ ...slideForm, beat_offset: event.target.value })}
                placeholder="0"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
              />
            </label>

            <label className="sm:col-span-2">
              <span className="block text-sm font-medium text-[var(--foreground)] mb-1">
                {t("slideOrder")}
              </span>
              <input
                type="number"
                name="order"
                min="0"
                value={slideForm.order}
                onChange={(event) => setSlideForm({ ...slideForm, order: event.target.value })}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
              />
            </label>

            <div className="sm:col-span-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpenSlideForm(false)}
                className="toolbar-button"
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="toolbar-button toolbar-button-primary disabled:opacity-50"
              >
                {saving ? t("saving") : t("saveSlide")}
              </button>
            </div>
          </form>
        </div>
      )}
    </PageShell>
  );
}
