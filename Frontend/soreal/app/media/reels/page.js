"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Plus,
  Trash2,
  Edit3,
  Play,
  Video,
  X,
  RefreshCw,
  Check,
  CheckSquare,
  RotateCcw,
} from "lucide-react";
import { useTranslation } from "@/app/components/LanguageProvider";
import PageShell from "@/app/components/PageShell";
import {
  fetchReels,
  createReel,
  updateReel,
  deleteReel,
  batchRenderReels,
} from "@/lib/api";
import ToolbarMenu from "@/app/components/ToolbarMenu";

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

const ASPECT_LABELS = {
  "9:16": "9:16 Vertical",
  "1:1": "1:1 Square",
  "16:9": "16:9 Landscape",
};

export default function ReelLibraryPage() {
  const { translate: t } = useTranslation();
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    estate: "",
    audio_track: "",
    bpm: "",
    aspect_ratio: "9:16",
    status: "draft",
  });
  const [statusFilter, setStatusFilter] = useState("");
  const [aspectFilter, setAspectFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [selectedReels, setSelectedReels] = useState(new Set());
  const [batchRendering, setBatchRendering] = useState(false);

  const isSelected = (id) => selectedReels.has(id);
  const toggleSelect = (id) => {
    setSelectedReels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedReels.size === filteredReels.length && filteredReels.length > 0) {
      setSelectedReels(new Set());
    } else {
      setSelectedReels(new Set(filteredReels.map((r) => r.id)));
    }
  };
  const draftReels = reels.filter((r) => r.status === "draft");
  const selectedDraftReels = [...selectedReels].filter(
    (id) => draftReels.some((r) => r.id === id)
  );

  const fetchReelsList = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (aspectFilter) params.aspect_ratio = aspectFilter;
      const data = await fetchReels(params);
      const results = data.results || data || [];
      setReels(results);
    } catch (err) {
      setError(err.message || t("error"));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, aspectFilter, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchReelsList();
  }, [fetchReelsList]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        bpm: form.bpm === "" ? null : Number(form.bpm),
        estate: form.estate || null,
        audio_track: form.audio_track || null,
      };
      if (editingId) {
        await updateReel(editingId, payload);
      } else {
        await createReel(payload);
      }
      setOpenForm(false);
      setEditingId(null);
      setForm({
        title: "",
        description: "",
        estate: "",
        audio_track: "",
        bpm: "",
        aspect_ratio: "9:16",
        status: "draft",
      });
      await fetchReelsList();
    } catch (err) {
      setError(err.message || t("error"));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (reel) => {
    setEditingId(reel.id);
    setForm({
      title: reel.title || "",
      description: reel.description || "",
      estate: reel.estate || "",
      audio_track: reel.audio_track || "",
      bpm: reel.bpm ?? "",
      aspect_ratio: reel.aspect_ratio || "9:16",
      status: reel.status || "draft",
    });
    setOpenForm(true);
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await deleteReel(id);
      setSelectedReels((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      await fetchReelsList();
    } catch (err) {
      setError(err.message || t("error"));
    } finally {
      setDeletingId(null);
    }
  };

  const handleRender = async (id) => {
    try {
      await updateReel(id, { status: "rendering" });
      await fetchReelsList();
    } catch (err) {
      setError(err.message || t("error"));
    }
  };

  const handleBatchRender = async () => {
    if (selectedDraftReels.length === 0) return;
    setBatchRendering(true);
    try {
      await batchRenderReels(selectedDraftReels);
      setSelectedReels(new Set());
      await fetchReelsList();
    } catch (err) {
      setError(err.message || t("error"));
    } finally {
      setBatchRendering(false);
    }
  };

  const filteredReels = reels.filter(
    (r) =>
      (!statusFilter || r.status === statusFilter) &&
      (!aspectFilter || r.aspect_ratio === aspectFilter)
  );

  const formatDuration = (seconds) => {
    if (seconds == null) return "-";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const getReelListContent = () => {
    if (loading) {
      return (
        <div className="h-64 flex items-center justify-center text-[var(--text-muted)]">
          {t("loadingReels")}
        </div>
      );
    }
    if (filteredReels.length === 0) {
      return (
        <div className="h-64 flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-center text-sm text-[var(--text-muted)]">
          <Video size={32} className="mb-2 text-[var(--text-muted-light)]" />
          <p>{t("noReelsYet")}</p>
        </div>
      );
    }
    return (
      <div className="space-y-2 max-h-[700px] overflow-y-auto">
        {filteredReels.map((reel) => (
          <div
            key={reel.id}
            className="flex items-start justify-between gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--surface-surface)] hover:bg-[var(--surface-hover)] transition group"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <input
                  type="checkbox"
                  checked={isSelected(reel.id)}
                  onChange={() => toggleSelect(reel.id)}
                  className="rounded border-[var(--border)] text-[var(--green)] focus:ring-[var(--green)] mt-0.5"
                />
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded ${STATUS_COLORS[reel.status]}`}
                >
                  {STATUS_LABELS[reel.status] || reel.status}
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  {ASPECT_LABELS[reel.aspect_ratio] || reel.aspect_ratio}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-[var(--foreground)] truncate">
                {reel.title || t("untitledReel")}
              </h3>
              {reel.description && (
                <p className="text-xs text-[var(--text-muted)] line-clamp-2 mt-1">
                  {reel.description}
                </p>
              )}
              {reel.estate_title && (
                <p className="text-xs text-[var(--green)] mt-1 truncate">
                  🏠 {reel.estate_title}
                </p>
              )}
              <div className="mt-2 flex items-center gap-3 text-xs text-[var(--text-muted)]">
                <span>{reel.bpm ? `${reel.bpm} BPM` : "-"}</span>
                <span>· {formatDuration(reel.duration_seconds)}</span>
                {reel.audio_track_title && <span>· 🎵 {reel.audio_track_title}</span>}
              </div>
            </div>
            <div className="flex items-center gap-1 ml-2">
              {reel.status === "draft" && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRender(reel.id);
                  }}
                  className="p-1.5 bg-amber-50 text-amber-600 rounded hover:bg-amber-100"
                  title={t("renderReel")}
                >
                  <Play size={14} />
                </button>
              )}
              {reel.status === "ready" && (
                <Link
                  href={`/media/reels/${reel.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="p-1.5 text-[var(--text-muted)] hover:text-[var(--green)]"
                  title={t("viewOriginal")}
                >
                  <Video size={14} />
                </Link>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEdit(reel);
                }}
                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--green)]"
                title={t("edit")}
              >
                <Edit3 size={14} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(reel.id);
                }}
                className="p-1.5 text-[var(--text-muted)] hover:text-red-600"
                title={t("deleteReel")}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const selectAllChecked =
    filteredReels.length > 0 && selectedReels.size === filteredReels.length;

  return (
    <PageShell
      eyebrow={t("reelLibrary")}
      title={t("reelLibrary")}
      description={t("reelLibraryDescription")}
      actions={
        <>
          <Link href="/estates" className="toolbar-button">
            <Calendar size={16} />
            {t("viewEstates")}
          </Link>
          {selectedReels.size > 0 && selectedDraftReels.length > 0 && (
            <button
              type="button"
              onClick={handleBatchRender}
              disabled={batchRendering}
              className="toolbar-button toolbar-button-primary disabled:opacity-50"
            >
              {batchRendering ? (
                <RotateCcw size={14} className="animate-spin" />
              ) : (
                <Check size={14} />
              )}
              {selectedDraftReels.length === 1
                ? t("renderSelected")
                : `${t("renderSelected")} (${selectedDraftReels.length})`}
            </button>
          )}
          {selectedReels.size > 0 && (
            <button
              type="button"
              onClick={() => setSelectedReels(new Set())}
              className="toolbar-button text-[var(--text-muted)] hover:text-red-600"
              title={t("clearSelection")}
            >
              <X size={14} />
              {t("clearSelection")}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setForm({
                title: "",
                description: "",
                estate: "",
                audio_track: "",
                bpm: "",
                aspect_ratio: "9:16",
                status: "draft",
              });
              setOpenForm(true);
            }}
            className="toolbar-button toolbar-button-primary"
          >
            <Plus size={16} />
            {t("newReel")}
          </button>
          <ToolbarMenu label={t("filters")}>
            <button
              type="button"
              onClick={() => setStatusFilter("")}
              className={`toolbar-menu-item ${!statusFilter ? "toolbar-tab-active" : ""}`}
            >
              {t("allStatuses")}
            </button>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={`toolbar-menu-item ${statusFilter === key ? "toolbar-tab-active" : ""}`}
              >
                {label}
              </button>
            ))}
            <div className="toolbar-divider" />
            <button
              type="button"
              onClick={() => setAspectFilter("")}
              className={`toolbar-menu-item ${!aspectFilter ? "toolbar-tab-active" : ""}`}
            >
              {t("allRatios")}
            </button>
            {Object.entries(ASPECT_LABELS).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setAspectFilter(key)}
                className={`toolbar-menu-item ${aspectFilter === key ? "toolbar-tab-active" : ""}`}
              >
                {label}
              </button>
            ))}
          </ToolbarMenu>
        </>
      }
    >
      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <div className="col-span-1 md:col-span-2 lg:col-span-2">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {filteredReels.length > 0 && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectAllChecked}
                      onChange={toggleSelectAll}
                      className="rounded border-[var(--border)] text-[var(--green)] focus:ring-[var(--green)]"
                    />
                    <span className="text-xs text-[var(--text-muted)]">
                      {t("selectAll")}
                    </span>
                  </label>
                )}
                <span className="text-xs text-[var(--text-muted)] ml-2">
                  {selectedReels.size > 0
                    ? `${t("selected")}: ${selectedReels.size}`
                    : `${t("total")}: ${filteredReels.length}`}
                </span>
              </div>
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <button
                  type="button"
                  onClick={fetchReelsList}
                  className="text-xs text-[var(--text-muted)] hover:underline"
                >
                  {t("refresh")}
                </button>
              )}
            </div>
            {getReelListContent()}
          </div>
        </div>

        <div className="col-span-1 md:col-span-1 lg:col-span-1">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold">{t("quickStats")}</h2>
            <div className="grid gap-2">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--surface-muted)]">
                <Video size={16} className="text-[var(--text-muted)]" />
                <span className="text-sm font-semibold">{reels.length}</span>
                <span className="text-xs text-[var(--text-muted)]">{t("totalReels")}</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--surface-muted)]">
                <Play size={16} className="text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-700">
                  {reels.filter((r) => r.status === "ready").length}
                </span>
                <span className="text-xs text-[var(--text-muted)]">{t("readyReels")}</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--surface-muted)]">
                <Calendar size={16} className="text-amber-600" />
                <span className="text-sm font-semibold text-amber-700">
                  {reels.filter((r) => r.status === "draft").length}
                </span>
                <span className="text-xs text-[var(--text-muted)]">{t("draftReels")}</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--surface-muted)]">
                <Trash2 size={16} className="text-red-600" />
                <span className="text-sm font-semibold text-red-700">
                  {reels.filter((r) => r.status === "failed").length}
                </span>
                <span className="text-xs text-[var(--text-muted)]">{t("failedReels")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {openForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <form
            onSubmit={handleSubmit}
            className="my-4 grid w-full max-w-2xl gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl sm:grid-cols-2"
          >
            <div className="flex items-center justify-between gap-3 sm:col-span-2">
              <h2 className="text-lg font-semibold">
                {editingId ? t("editReel") : t("newReel")}
              </h2>
              <button
                type="button"
                onClick={() => setOpenForm(false)}
                className="toolbar-button"
              >
                <X size={16} />
                {t("close")}
              </button>
            </div>

            <label className="sm:col-span-2">
              <span className="block text-sm font-medium text-[var(--foreground)] mb-1">
                {t("reelTitle")}
              </span>
              <input
                type="text"
                name="title"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder={t("reelTitlePlaceholder")}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
              />
            </label>

            <label className="sm:col-span-2">
              <span className="block text-sm font-medium text-[var(--foreground)] mb-1">
                {t("reelDescription")}
              </span>
              <textarea
                name="description"
                rows={3}
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder={t("reelDescriptionPlaceholder")}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
              />
            </label>

            <label className="sm:col-span-2">
              <span className="block text-sm font-medium text-[var(--foreground)] mb-1">
                {t("estate")}
              </span>
              <select
                name="estate"
                value={form.estate}
                onChange={(event) => setForm({ ...form, estate: event.target.value })}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
              >
                <option value="">{t("noEstate")}</option>
              </select>
            </label>

            <label className="sm:col-span-2">
              <span className="block text-sm font-medium text-[var(--foreground)] mb-1">
                {t("audioTrack")}
              </span>
              <select
                name="audio_track"
                value={form.audio_track}
                onChange={(event) => setForm({ ...form, audio_track: event.target.value })}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
              >
                <option value="">{t("noAudioTrack")}</option>
              </select>
            </label>

            <label className="sm:col-span-2">
              <span className="block text-sm font-medium text-[var(--foreground)] mb-1">
                {t("bpm")}
              </span>
              <input
                type="number"
                name="bpm"
                min="40"
                max="200"
                value={form.bpm}
                onChange={(event) => setForm({ ...form, bpm: event.target.value })}
                placeholder={t("bpmPlaceholder")}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
              />
            </label>

            <label className="sm:col-span-2">
              <span className="block text-sm font-medium text-[var(--foreground)] mb-1">
                {t("aspectRatio")}
              </span>
              <select
                name="aspect_ratio"
                value={form.aspect_ratio}
                onChange={(event) => setForm({ ...form, aspect_ratio: event.target.value })}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
              >
                <option value="9:16">{t("aspectRatio916")}</option>
                <option value="1:1">{t("aspectRatio11")}</option>
                <option value="16:9">{t("aspectRatio169")}</option>
              </select>
            </label>

            <label className="sm:col-span-2">
              <span className="block text-sm font-medium text-[var(--foreground)] mb-1">
                {t("status")}
              </span>
              <select
                name="status"
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value })}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
              >
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <div className="sm:col-span-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpenForm(false)}
                className="toolbar-button"
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="toolbar-button toolbar-button-primary disabled:opacity-50"
              >
                {saving ? t("saving") : t("saveReel")}
              </button>
            </div>
          </form>
        </div>
      )}
    </PageShell>
  );
}
