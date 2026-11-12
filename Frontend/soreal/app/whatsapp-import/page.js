"use client";

import { useState } from "react";
import Link from "next/link";
import { importWhatsAppChat } from "@/lib/api";
import { useTranslation } from "@/app/components/LanguageProvider";
import PageShell from "@/app/components/PageShell";
import StatStrip from "@/app/components/StatStrip";

export default function WhatsAppImportPage() {
  const { translate: t } = useTranslation();
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [error, setError] = useState(null);
  const [zipFile, setZipFile] = useState(null);
  const [recentDays, setRecentDays] = useState("30");

  const handleFileChange = (e) => {
    setZipFile(e.target.files[0]);
    setError(null);
    setImportResult(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!zipFile) {
      setError("Please select a ZIP file first.");
      return;
    }

    setImporting(true);
    setError(null);
    setImportResult(null);

    const formData = new FormData();
    formData.append("zip_file", zipFile);
    formData.append("recent_days", recentDays);
    formData.append("debug", "false");

    try {
      const result = await importWhatsAppChat(formData);
      setImportResult(result);
    } catch (err) {
      setError(err.message || "Failed to import WhatsApp chat.");
    } finally {
      setImporting(false);
    }
  };

  const statusColor = (status) => {
    const colors = {
      new: "bg-blue-100 text-blue-800",
      contacted: "bg-yellow-100 text-yellow-800",
      matched: "bg-green-100 text-green-800",
      closed: "bg-gray-100 text-gray-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  return (
    <PageShell
      title={t("whatsappImport")}
      description={t("whatsappImportDescription")}
      actions={(
        <Link href="/requests" className="toolbar-button">
          ← {t("backToRequests")}
        </Link>
      )}
    >
      <div className="max-w-3xl space-y-3">
        <div className="compact-card">
          <h2 className="mb-2 text-base font-semibold">{t("importWhatsAppChat")}</h2>
          <p className="mb-2 text-xs text-[var(--text-muted)]">{t("whatsappMediaDescription")}</p>

          {error && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid gap-3">
            <label className="filter-field">
              <span>{t("selectZipFile")}</span>
              <input
                type="file"
                accept=".zip"
                onChange={handleFileChange}
                disabled={importing}
                className="disabled:opacity-50"
              />
            </label>
            {zipFile && (
              <p className="-mt-2 text-xs text-[var(--text-muted)]">
                {zipFile.name} ({(zipFile.size / 1024).toFixed(1)} KB)
              </p>
            )}

            <label className="filter-field">
              <span>{t("recentDays")}</span>
              <select
                value={recentDays}
                onChange={(e) => setRecentDays(e.target.value)}
                disabled={importing}
              >
                <option value="7">{t("last7Days")}</option>
                <option value="30">{t("last30Days")}</option>
                <option value="90">{t("last90Days")}</option>
                <option value="365">{t("last365Days")}</option>
              </select>
            </label>

            <button
              type="submit"
              disabled={importing || !zipFile}
              className="toolbar-button toolbar-button-primary disabled:opacity-50"
            >
              {importing ? t("importing") : t("importChat")}
            </button>
          </form>
        </div>

        {importResult && (
          <div className="compact-card border-green-200 bg-green-50">
            <h2 className="mb-2 text-base font-bold text-green-800">
              {t("importComplete")}
            </h2>
            <StatStrip
              items={[
                { label: t("leadsImported"), value: importResult.imported },
                { label: t("mediaImported"), value: importResult.media_imported || 0 },
                { label: t("skipped"), value: importResult.skipped },
                { label: t("ignoredRequests"), value: importResult.ignored || 0 },
                { label: t("scanInbox"), value: importResult.inbox_saved || 0 },
                { label: t("matchesCreated"), value: importResult.matches_created },
                { label: t("linkedToBroker"), value: importResult.brokers_linked || 0 },
                { label: t("totalMessagesProcessed"), value: importResult.total_messages },
              ]}
            />
            {importResult.errors && importResult.errors.length > 0 && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700">
                <div className="mb-1 font-medium">{t("errors")}</div>
                <ul className="list-inside list-disc">
                  {importResult.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-3 text-sm font-medium">
              <Link href="/scan-inbox" className="text-green-700 hover:underline">
                {t("scanInbox")} →
              </Link>
              <Link href="/requests" className="text-green-700 hover:underline">
                {t("reviewRequests")} →
              </Link>
              <Link href="/lead-matches" className="text-[var(--green)] hover:underline">
                {t("viewMatches")} →
              </Link>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
