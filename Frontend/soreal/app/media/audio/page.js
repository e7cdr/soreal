"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Trash2,
  Edit3,
  Music,
  Play,
  X,
  RefreshCw,
  Waves,
} from "lucide-react";
import { useTranslation } from "@/app/components/LanguageProvider";
import PageShell from "@/app/components/PageShell";
import {
  fetchAudioTracks,
  createAudioTrack,
  updateAudioTrack,
  deleteAudioTrack,
} from "@/lib/api";

const STATUS_LABELS = {
  uploaded: "Uploaded",
  analyzing: "Analyzing",
  analyzed: "Analyzed",
  failed: "Failed",
};

const STATUS_COLORS = {
  uploaded: "bg-[var(--surface-muted)] text-[var(--text-muted)]",
  analyzing: "bg-blue-100 text-blue-700",
  analyzed: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
};

export default function AudioTracksPage() {
  const { translate: t } = useTranslation();
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    title: "",
    genre_tag: "",
  });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const fetchTracks = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchAudioTracks({});
      const results = data.results || data || [];
      setTracks(results);
    } catch (err) {
      setError(err.message || t("error"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTracks();
  }, [fetchTracks]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        title: form.title || null,
        genre_tag: form.genre_tag || null,
      };
      if (editingId) {
        await updateAudioTrack(editingId, payload);
      } else {
        await createAudioTrack(payload);
      }
      setOpenForm(false);
      setEditingId(null);
      setForm({ title: "", genre_tag: "" });
      await fetchTracks();
    } catch (err) {
      setError(err.message || t("error"));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (track) => {
    setEditingId(track.id);
    setForm({
      title: track.title || "",
      genre_tag: track.genre_tag || "",
    });
    setOpenForm(true);
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await deleteAudioTrack(id);
      await fetchTracks();
    } catch (err) {
      setError(err.message || t("error"));
    } finally {
      setDeletingId(null);
    }
  };

  const handleAnalyze = async (id) => {
    try {
      await updateAudioTrack(id, { status: "analyzing" });
      await fetchTracks();
    } catch (err) {
      setError(err.message || t("error"));
    }
  };

  const formatDuration = (seconds) => {
    if (seconds == null) return "-";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <PageShell
      eyebrow={t("audioTracks")}
      title={t("audioTracks")}
      description={t("audioTracksDescription")}
      actions={
        <>
          <Link href="/media/reels" className="toolbar-button">
            <Play size={16} />
            {t("backToReelLibrary")}
          </Link>
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setForm({ title: "", genre_tag: "" });
              setOpenForm(true);
            }}
            className="toolbar-button toolbar-button-primary"
          >
            <Plus size={16} />
            {t("uploadAudio")}
          </button>
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
              <h2 className="text-lg font-semibold">{t("audioTracks")}</h2>
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <button
                  type="button"
                  onClick={fetchTracks}
                  className="text-xs text-[var(--text-muted)] hover:underline"
                >
                  {t("refresh")}
                </button>
              )}
            </div>

            {loading ? (
              <div className="h-64 flex items-center justify-center text-[var(--text-muted)]">
                {t("loadingAudio")}
              </div>
            ) : tracks.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-center text-sm text-[var(--text-muted)]">
                <Music size={32} className="mb-2 text-[var(--text-muted-light)]" />
                <p>{t("noAudioTracks")}</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[700px] overflow-y-auto">
                {tracks.map((track) => (
                  <div
                    key={track.id}
                    className="flex items-start justify-between gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--surface-surface)] hover:bg-[var(--surface-hover)] cursor-pointer transition group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded ${STATUS_COLORS[track.status]}`}
                        >
                          {STATUS_LABELS[track.status] || track.status}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-[var(--foreground)] truncate">
                        {track.title || t("untitledAudio")}
                      </h3>
                      {track.genre_tag && (
                        <p className="text-xs text-[var(--text-muted)] mt-1">
                          🎵 {track.genre_tag}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-3 text-xs text-[var(--text-muted)]">
                        <span>{formatDuration(track.duration_seconds)}</span>
                        {track.bpm && <span>· {track.bpm} BPM</span>}
                        {track.key && <span>· {t("key")}: {track.key}</span>}
                      </div>
                      {track.waveform_peaks && track.waveform_peaks.length > 0 && (
                        <div className="mt-3 h-4 flex items-end gap-0.5">
                          {track.waveform_peaks.map((peak, i) => (
                            <div
                              key={i}
                              className="w-[2px] bg-[var(--text-muted-light)] rounded-sm"
                              style={{ height: `${Math.max(peak * 100, 10)}%` }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      {track.status === "uploaded" && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAnalyze(track.id);
                          }}
                          className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                          title={t("analyzeAudio")}
                        >
                          <Play size={14} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(track);
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
                          handleDelete(track.id);
                        }}
                        className="p-1.5 text-[var(--text-muted)] hover:text-red-600"
                        title={t("deleteAudioTrack")}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="col-span-1 md:col-span-1 lg:col-span-1">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold">{t("quickStats")}</h2>
            <div className="grid gap-2">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--surface-muted)]">
                <Music size={16} className="text-[var(--text-muted)]" />
                <span className="text-sm font-semibold">{tracks.length}</span>
                <span className="text-xs text-[var(--text-muted)]">{t("totalAudioTracks")}</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--surface-muted)]">
                <Waves size={16} className="text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-700">
                  {tracks.filter((t) => t.status === "analyzed").length}
                </span>
                <span className="text-xs text-[var(--text-muted)]">{t("analyzed")}</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--surface-muted)]">
                <Play size={16} className="text-blue-600" />
                <span className="text-sm font-semibold text-blue-700">
                  {tracks.filter((t) => t.status === "analyzing").length}
                </span>
                <span className="text-xs text-[var(--text-muted)]">{t("analyzing")}</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--surface-muted)]">
                <Trash2 size={16} className="text-red-600" />
                <span className="text-sm font-semibold text-red-700">
                  {tracks.filter((t) => t.status === "failed").length}
                </span>
                <span className="text-xs text-[var(--text-muted)]">{t("failed")}</span>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]">
              <h3 className="text-xs font-semibold text-[var(--foreground)] mb-2">
                {t("howToUse")}
              </h3>
              <ul className="text-xs text-[var(--text-muted)] space-y-1 list-disc pl-4">
                <li>{t("howToUse1")}</li>
                <li>{t("howToUse2")}</li>
                <li>{t("howToUse3")}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {openForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <form
            onSubmit={handleSubmit}
            className="my-4 grid w-full max-w-md gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">
                {editingId ? t("editAudioTrack") : t("uploadAudio")}
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

            <label className="col-span-2">
              <span className="block text-sm font-medium text-[var(--foreground)] mb-1">
                {t("audioTitle")}
              </span>
              <input
                type="text"
                name="title"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder={t("audioTitlePlaceholder")}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
              />
            </label>

            <label className="col-span-2">
              <span className="block text-sm font-medium text-[var(--foreground)] mb-1">
                {t("genreTag")}
              </span>
              <input
                type="text"
                name="genre_tag"
                value={form.genre_tag}
                onChange={(event) => setForm({ ...form, genre_tag: event.target.value })}
                placeholder={t("genreTagPlaceholder")}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
              />
            </label>

            <div className="col-span-2 flex justify-end gap-2">
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
                {saving ? t("saving") : t("saveAudioTrack")}
              </button>
            </div>
          </form>
        </div>
      )}
    </PageShell>
  );
}
