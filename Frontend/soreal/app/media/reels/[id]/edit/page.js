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
  Palette,
  RotateCcw,
  Film,
  Wand,
  Type,
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
  "top-left": "Top Left",
  "top-right": "Top Right",
  "bottom-left": "Bottom Left",
  "bottom-right": "Bottom Right",
  "lower-third": "Lower Third",
};

const FONT_LABELS = {
  "sans-serif": "Sans Serif",
  serif: "Serif",
  monospace: "Monospace",
  script: "Script",
  display: "Display",
};

const COLOR_LABELS = {
  white: "White",
  black: "Black",
  yellow: "Yellow",
  gold: "Gold",
  red: "Red",
  blue: "Blue",
  green: "Green",
  custom: "Custom",
};

const ANIMATION_LABELS = {
  none: "None",
  "fade-in": "Fade In",
  "slide-up": "Slide Up",
  "slide-down": "Slide Down",
  bounce: "Bounce",
  "zoom-in": "Zoom In",
  typewriter: "Typewriter",
};

const TEXT_STYLE_PRESETS = {
  title: {
    text_position: "center",
    text_font_family: "sans-serif",
    text_font_scale: 1.4,
    text_color: "white",
    text_background: true,
    text_background_opacity: 0.5,
    text_animation: "fade-in",
    text_shadow: true,
    lower_third: false,
  },
  subtitle: {
    text_position: "center",
    text_font_family: "sans-serif",
    text_font_scale: 1.0,
    text_color: "white",
    text_background: false,
    text_animation: "fade-in",
    text_shadow: true,
    lower_third: false,
  },
  caption: {
    text_position: "bottom",
    text_font_family: "sans-serif",
    text_font_scale: 0.9,
    text_color: "white",
    text_background: true,
    text_background_opacity: 0.7,
    text_animation: "none",
    text_shadow: true,
    lower_third: false,
  },
  "lower-third": {
    text_position: "lower-third",
    text_font_family: "sans-serif",
    text_font_scale: 1.0,
    text_color: "white",
    text_background: true,
    text_background_opacity: 0.8,
    text_animation: "slide-up",
    text_shadow: true,
    lower_third: true,
  },
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
    text_font_family: "sans-serif",
    text_color: "white",
    text_custom_color: "",
    text_background: false,
    text_background_opacity: 0.6,
    text_animation: "none",
    text_animation_duration: 0.5,
    text_shadow: true,
    lower_third: false,
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
      text_font_family: "sans-serif",
      text_color: "white",
      text_custom_color: "",
      text_background: false,
      text_background_opacity: 0.6,
      text_animation: "none",
      text_animation_duration: 0.5,
      text_shadow: true,
      lower_third: false,
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
      text_font_family: slide.text_font_family || "sans-serif",
      text_color: slide.text_color || "white",
      text_custom_color: slide.text_custom_color || "",
      text_background: slide.text_background ?? false,
      text_background_opacity: slide.text_background_opacity ?? 0.6,
      text_animation: slide.text_animation || "none",
      text_animation_duration: slide.text_animation_duration ?? 0.5,
      text_shadow: slide.text_shadow ?? true,
      lower_third: slide.lower_third ?? false,
      beat_offset: slide.beat_offset || 0,
      order: slide.order,
    });
    setOpenSlideForm(true);
  };

  const applyTextStyle = (styleKey) => {
    const preset = TEXT_STYLE_PRESETS[styleKey];
    if (!preset) return;
    setSlideForm((prev) => ({ ...prev, ...preset }));
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
        text_background_opacity: Number(slideForm.text_background_opacity),
        text_animation_duration: Number(slideForm.text_animation_duration),
        beat_offset: Number(slideForm.beat_offset),
        order: Number(slideForm.order),
        text_background: slideForm.text_background === "true" || slideForm.text_background === true,
        text_shadow: slideForm.text_shadow === "true" || slideForm.text_shadow === true,
        lower_third: slideForm.lower_third === "true" || slideForm.lower_third === true,
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
    Promise.all(
      newSlides.map((s, i) => updateReelSlide(s.id, { order: i }).catch(() => {}))
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
      newSlides.map((s, i) => updateReelSlide(s.id, { order: i }).catch(() => {}))
    ).then(() => fetchReelDetail());
  };

  const resolvedColor =
    slideForm.text_color === "custom" && slideForm.text_custom_color
      ? slideForm.text_custom_color
      : slideForm.text_color;

  const previewStyle = {
    color:
      resolvedColor === "white"
        ? "#ffffff"
        : resolvedColor === "black"
          ? "#000000"
          : resolvedColor === "yellow"
            ? "#ffeb3b"
            : resolvedColor === "gold"
              ? "#ffd700"
              : resolvedColor === "red"
                ? "#ef4444"
                : resolvedColor === "blue"
                  ? "#3b82f6"
                  : resolvedColor === "green"
                    ? "#22c55e"
                    : slideForm.text_custom_color || "#ffffff",
    fontFamily:
      slideForm.text_font_family === "sans-serif"
        ? "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        : slideForm.text_font_family === "serif"
          ? "Georgia, 'Times New Roman', serif"
          : slideForm.text_font_family === "monospace"
            ? "'Courier New', Courier, monospace"
            : slideForm.text_font_family === "script"
              ? "'Brush Script MT', cursive"
              : "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontSize: `${1.2 * Number(slideForm.text_font_scale || 1)}rem`,
    backgroundColor:
      slideForm.text_background
        ? `rgba(0, 0, 0, ${Number(slideForm.text_background_opacity || 0.6)})`
        : "transparent",
    textShadow:
      slideForm.text_shadow ? "0 2px 4px rgba(0,0,0,0.5)" : "none",
    padding: slideForm.text_background ? "0.5rem 1rem" : "0",
    borderRadius: slideForm.text_background ? "0.5rem" : "0",
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

  const lowerThirdPreview = reel.estate
    ? `${reel.estate_title || t("untitledEstate")} — ${reel.estate_price || t("estatePrice")}`
    : "";

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
                    {slide.text_animation && slide.text_animation !== "none" && (
                      <span className="text-[var(--text-muted)] text-xs">
                        • {t("animationFadeIn")}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--foreground)] truncate">
                    {slide.text_overlay || t("noTextOverlay")}
                  </p>
                  {slide.lower_third && (
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      🏠 {t("lowerThird")}
                    </p>
                  )}
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
            className="my-4 grid w-full max-w-3xl gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl sm:grid-cols-3"
          >
            <div className="flex items-center justify-between gap-3 sm:col-span-3">
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

            {/* Typography presets */}
            <div className="sm:col-span-3">
              <div className="flex items-center gap-2 mb-2">
                <Palette size={16} className="text-[var(--text-muted)]" />
                <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  {t("textStyle")}
                </span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(TEXT_STYLE_PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => applyTextStyle(key)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                      slideForm.text_position === preset.text_position &&
                      slideForm.text_font_family === preset.text_font_family &&
                      slideForm.text_font_scale === preset.text_font_scale
                        ? "bg-[var(--green)] text-white border-[var(--green)]"
                        : "bg-[var(--surface-muted)] border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
                    }`}
                  >
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Image selection */}
            <label className="sm:col-span-3">
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

            <label className="sm:col-span-3">
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

            {/* Text content */}
            <label className="sm:col-span-3">
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

            {/* Font family */}
            <label className="sm:col-span-1">
              <span className="block text-sm font-medium text-[var(--foreground)] mb-1">
                {t("fontFamily")}
              </span>
              <select
                name="text_font_family"
                value={slideForm.text_font_family}
                onChange={(event) =>
                  setSlideForm({ ...slideForm, text_font_family: event.target.value })
                }
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
              >
                {Object.entries(FONT_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            {/* Font scale */}
            <label className="sm:col-span-1">
              <span className="block text-sm font-medium text-[var(--foreground)] mb-1">
                {t("textFontScale")}
              </span>
              <input
                type="range"
                name="text_font_scale"
                min="0.5"
                max="2.5"
                step="0.1"
                value={slideForm.text_font_scale}
                onChange={(event) =>
                  setSlideForm({ ...slideForm, text_font_scale: event.target.value })
                }
                className="w-full accent-[var(--green)]"
              />
              <div className="flex justify-between mt-1">
                <span className="text-xs text-[var(--text-muted)]">0.5×</span>
                <span className="text-xs text-[var(--text-muted)]">{Number(slideForm.text_font_scale).toFixed(1)}×</span>
                <span className="text-xs text-[var(--text-muted)]">2.5×</span>
              </div>
            </label>

            {/* Text color */}
            <label className="sm:col-span-1">
              <span className="block text-sm font-medium text-[var(--foreground)] mb-1">
                {t("textColor")}
              </span>
              <select
                name="text_color"
                value={slideForm.text_color}
                onChange={(event) =>
                  setSlideForm({
                    ...slideForm,
                    text_color: event.target.value,
                    text_custom_color:
                      event.target.value === "custom"
                        ? slideForm.text_custom_color || "#ffffff"
                        : "",
                  })
                }
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
              >
                {Object.entries(COLOR_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              {slideForm.text_color === "custom" && (
                <input
                  type="color"
                  name="text_custom_color"
                  value={slideForm.text_custom_color || "#ffffff"}
                  onChange={(event) =>
                    setSlideForm({ ...slideForm, text_custom_color: event.target.value })
                  }
                  className="mt-1 w-full h-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] cursor-pointer"
                />
              )}
            </label>

            {/* Text background */}
            <div className="sm:col-span-1 flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={slideForm.text_background === true || slideForm.text_background === "true"}
                  onChange={(event) =>
                    setSlideForm({ ...slideForm, text_background: event.target.checked })
                  }
                  className="rounded border-[var(--border)] text-[var(--green)] focus:ring-[var(--green)]"
                />
                <span className="text-sm text-[var(--foreground)]">{t("textBackground")}</span>
              </label>
            </div>

            {/* Background opacity */}
            <label className="sm:col-span-2">
              <span className="block text-sm font-medium text-[var(--foreground)] mb-1">
                {t("textBackgroundOpacity")}
              </span>
              <input
                type="range"
                name="text_background_opacity"
                min="0"
                max="1"
                step="0.1"
                disabled={!slideForm.text_background}
                value={slideForm.text_background_opacity}
                onChange={(event) =>
                  setSlideForm({ ...slideForm, text_background_opacity: event.target.value })
                }
                className={`w-full accent-[var(--green)] ${!slideForm.text_background ? "opacity-50 cursor-not-allowed" : ""}`}
              />
            </label>

            {/* Text shadow */}
            <div className="sm:col-span-1 flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={slideForm.text_shadow === true || slideForm.text_shadow === "true"}
                  onChange={(event) =>
                    setSlideForm({ ...slideForm, text_shadow: event.target.checked })
                  }
                  className="rounded border-[var(--border)] text-[var(--green)] focus:ring-[var(--green)]"
                />
                <span className="text-sm text-[var(--foreground)]">{t("textShadow")}</span>
              </label>
            </div>

            {/* Text animation */}
            <label className="sm:col-span-2">
              <span className="block text-sm font-medium text-[var(--foreground)] mb-1">
                {t("textAnimation")}
              </span>
              <select
                name="text_animation"
                value={slideForm.text_animation}
                onChange={(event) =>
                  setSlideForm({ ...slideForm, text_animation: event.target.value })
                }
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
              >
                {Object.entries(ANIMATION_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            {/* Animation duration */}
            <label className="sm:col-span-1">
              <span className="block text-sm font-medium text-[var(--foreground)] mb-1">
                {t("animationDuration")}
              </span>
              <input
                type="number"
                name="text_animation_duration"
                min="0.1"
                max="5"
                step="0.1"
                disabled={slideForm.text_animation === "none"}
                value={slideForm.text_animation_duration}
                onChange={(event) =>
                  setSlideForm({ ...slideForm, text_animation_duration: event.target.value })
                }
                className={`w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)] ${
                  slideForm.text_animation === "none" ? "opacity-50 cursor-not-allowed" : ""
                }`}
              />
            </label>

            {/* Lower third */}
            <div className="sm:col-span-3 flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={slideForm.lower_third === true || slideForm.lower_third === "true"}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setSlideForm({ ...slideForm, lower_third: checked });
                    if (checked) {
                      setSlideForm((prev) => ({
                        ...prev,
                        text_position: "lower-third",
                        text_background: true,
                        text_background_opacity: 0.8,
                        text_animation: "slide-up",
                      }));
                    }
                  }}
                  className="rounded border-[var(--border)] text-[var(--green)] focus:ring-[var(--green)]"
                />
                <span className="text-sm text-[var(--foreground)]">{t("lowerThird")}</span>
              </label>
              {reel.estate && (
                <button
                  type="button"
                  onClick={() => {
                    setSlideForm((prev) => ({
                      ...prev,
                      text_overlay: lowerThirdPreview || "",
                      lower_third: true,
                      text_position: "lower-third",
                    }));
                  }}
                  className="ml-2 text-xs text-[var(--green)] hover:underline"
                >
                  {t("estateInfo")}
                </button>
              )}
              {!reel.estate && (
                <span className="ml-2 text-xs text-[var(--text-muted)]">
                  {t("noEstateLinked")}
                </span>
              )}
              <p className="text-[var(--text-muted)] text-xs mt-1">
                {t("lowerThirdDescription")}
              </p>
            </div>

            {/* Beat sync */}
            <label className="sm:col-span-2">
              <span className="block text-sm font-medium text-[var(--foreground)] mb-1">
                {t("beatSync")}
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

            {/* Duration */}
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

            {/* Order */}
            <label className="sm:col-span-1">
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

            {/* Live text preview */}
            <div className="sm:col-span-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  {t("livePreview")}
                </span>
                <Wand size={14} className="text-[var(--text-muted)]" />
              </div>
              <div
                className={`relative aspect-video rounded-lg border border-[var(--border)] bg-black flex items-center justify-center overflow-hidden ${
                  slideForm.text_background ? "" : "bg-gradient-to-b from-black/80 to-black/20"
                }`}
              >
                <div
                  className={`p-4 max-w-full text-center ${
                    slideForm.text_position === "lower-third"
                      ? "absolute bottom-8 left-1/2 -translate-x-1/2"
                      : slideForm.text_position === "top"
                        ? "absolute top-8 left-1/2 -translate-x-1/2"
                        : slideForm.text_position === "bottom"
                          ? "absolute bottom-8 left-1/2 -translate-x-1/2"
                          : ""
                  }`}
                >
                  <div
                    className="inline-block"
                    style={previewStyle}
                  >
                    {slideForm.text_overlay || t("previewText")}
                  </div>
                </div>
              </div>
            </div>

            <div className="sm:col-span-3 flex justify-end gap-2">
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
