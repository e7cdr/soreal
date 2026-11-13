"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  RefreshCw,
  X,
  Play,
  LayoutList,
  Plus,
} from "lucide-react";
import { useTranslation } from "@/app/components/LanguageProvider";
import PageShell from "@/app/components/PageShell";
import {
  fetchReelTemplates,
  createReelFromTemplate,
} from "@/lib/api";

export default function ReelTemplatesPage() {
  const { translate: t } = useTranslation();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openUseDialog, setOpenUseDialog] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [useForm, setUseForm] = useState({ title: "" });
  const [saving, setSaving] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchReelTemplates({});
      const results = data.results || data || [];
      setTemplates(results);
    } catch (err) {
      setError(err.message || t("error"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTemplates();
  }, [fetchTemplates]);

  const handleUseTemplate = async (templateId) => {
    setSelectedTemplateId(templateId);
    setUseForm({ title: "" });
    setOpenUseDialog(true);
  };

  const handleSubmitUse = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await createReelFromTemplate(selectedTemplateId, {
        title: useForm.title || undefined,
      });
      setOpenUseDialog(false);
      setSaving(false);
      // Navigate to the new reel's edit page
      window.location.href = `/media/reels/${result.reel.id}/edit`;
    } catch (err) {
      setError(err.message || t("error"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageShell eyebrow={t("reelTemplates")} title={t("loadingTemplates")}>
        <div className="h-64 flex items-center justify-center text-[var(--text-muted)]">
          {t("loadingTemplates")}
        </div>
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell eyebrow={t("reelTemplates")} title={t("reelTemplates")}>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
          {error}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      eyebrow={t("reelTemplates")}
      title={t("reelTemplates")}
      description={t("reelTemplatesDescription")}
      actions={
        <>
          <Link href="/media/reels" className="toolbar-button">
            <Play size={16} />
            {t("backToReelLibrary")}
          </Link>
        </>
      }
    >
      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      {templates.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
          <div className="h-64 flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-muted)] text-center text-sm text-[var(--text-muted)]">
            <FileText size={32} className="mb-2 text-[var(--text-muted-light)]" />
            <p>{t("noTemplatesYet")}</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 max-h-[700px] overflow-y-auto">
          {templates.map((template) => (
            <div
              key={template.id}
              className="flex items-start justify-between gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--surface-surface)] hover:bg-[var(--surface-hover)] transition"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded border border-[var(--border)] ${
                      template.is_builtin ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-blue-50 text-blue-700 border-blue-200"
                    }`}
                  >
                    {template.is_builtin ? t("builtIn") : t("custom")}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-[var(--foreground)] truncate">
                  {template.name || t("untitledTemplate")}
                </h3>
                {template.description && (
                  <p className="text-xs text-[var(--text-muted)] line-clamp-2 mt-1">
                    {template.description}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-3 text-xs text-[var(--text-muted)]">
                  <span>{template.genre_tag || t("genreUnknown")}</span>
                  <span>· {template.bpm_min}-{template.bpm_max} BPM</span>
                  <span>· {template.slide_count} {t("slides")}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-2">
                <button
                  type="button"
                  onClick={() => handleUseTemplate(template.id)}
                  className="p-1.5 text-[var(--text-muted)] hover:text-[var(--green)]"
                  title={t("useTemplate")}
                >
                  <LayoutList size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Use Template dialog */}
      {openUseDialog && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <form
            onSubmit={handleSubmitUse}
            className="my-4 grid w-full max-w-md gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{t("useTemplate")}</h2>
              <button
                type="button"
                onClick={() => setOpenUseDialog(false)}
                className="toolbar-button"
              >
                <X size={16} />
                {t("close")}
              </button>
            </div>

            <label className="col-span-2">
              <span className="block text-sm font-medium text-[var(--foreground)] mb-1">
                {t("reelTitle")}
              </span>
              <input
                type="text"
                name="title"
                value={useForm.title}
                onChange={(event) => setUseForm({ ...useForm, title: event.target.value })}
                placeholder={t("reelTitlePlaceholder")}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)]"
              />
            </label>

            <p className="text-xs text-[var(--text-muted)] col-span-2">
              {t("useTemplateDescription")}
            </p>

            <div className="col-span-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpenUseDialog(false)}
                className="toolbar-button"
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="toolbar-button toolbar-button-primary disabled:opacity-50"
              >
                {saving ? t("saving") : t("createReel")}
              </button>
            </div>
          </form>
        </div>
      )}
    </PageShell>
  );
}
