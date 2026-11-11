"use client";

import { useState } from "react";
import Link from "next/link";
import { importWhatsAppChat } from "@/lib/api";
import { useTranslation } from "@/app/components/LanguageProvider";

export default function WhatsAppImportPage() {
  const { t } = useTranslation();
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [error, setError] = useState(null);
  const [zipFile, setZipFile] = useState(null);

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
    formData.append("recent_days", "30");
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
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{t("whatsappImport", {}, {})}</h1>
        <Link
          href="/leads"
          className="text-indigo-600 hover:underline text-sm"
        >
          ← {t("backToLeads", {}, {})}
        </Link>
      </div>

      <div className="bg-white border rounded-lg p-6 shadow-sm max-w-2xl">
        <h2 className="text-lg font-bold mb-4">{t("importWhatsAppChat", {}, {})}</h2>
        <p className="text-gray-600 mb-4">
          {t("whatsappImportDescription", {}, {})}
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              {t("selectZipFile", {}, {})}
            </label>
            <input
              type="file"
              accept=".zip"
              onChange={handleFileChange}
              disabled={importing}
              className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50"
            />
            {zipFile && (
              <p className="text-xs text-gray-500 mt-1">
                {zipFile.name} ({(zipFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <div className="pt-4">
            <label className="block text-sm font-medium mb-1">
              {t("recentDays", {}, {})}
            </label>
            <select
              className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              defaultValue="30"
            >
              <option value="7">{t("last7Days", {}, {})}</option>
              <option value="30">{t("last30Days", {}, {})}</option>
              <option value="90">{t("last90Days", {}, {})}</option>
              <option value="365">{t("last365Days", {}, {})}</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={importing || !zipFile}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300 font-medium"
          >
            {importing ? t("importing", {}, {}) : t("importChat", {}, {})}
          </button>
        </form>
      </div>

      {importResult && (
        <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-6">
          <h2 className="text-lg font-bold text-green-800 mb-4">
            {t("importComplete", {}, {})}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded border border-green-100">
              <div className="text-xs text-green-600 font-medium">
                {t("leadsImported", {}, {})}
              </div>
              <div className="text-2xl font-bold text-green-700">
                {importResult.imported}
              </div>
            </div>
            <div className="bg-white p-4 rounded border border-yellow-100">
              <div className="text-xs text-yellow-600 font-medium">
                {t("skipped", {}, {})}
              </div>
              <div className="text-2xl font-bold text-yellow-700">
                {importResult.skipped}
              </div>
            </div>
            <div className="bg-white p-4 rounded border border-blue-100">
              <div className="text-xs text-blue-600 font-medium">
                {t("matchesCreated", {}, {})}
              </div>
              <div className="text-2xl font-bold text-blue-700">
                {importResult.matches_created}
              </div>
            </div>
          </div>
          <div className="mt-4">
            <div className="text-xs text-gray-500 mb-1">
              {t("totalMessagesProcessed", {}, {})}
            </div>
            <div className="text-sm font-medium">
              {importResult.total_messages}
            </div>
          </div>
          {importResult.errors && importResult.errors.length > 0 && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              <div className="font-medium mb-2">{t("errors", {}, {})}</div>
              <ul className="text-sm list-disc list-inside">
                {importResult.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-6">
            <Link
              href="/leads"
              className="text-indigo-600 hover:underline font-medium"
            >
              {t("viewLeads", {}, {})} →
            </Link>
            <span className="ml-2 text-gray-400">|</span>
            <Link
              href="/lead-matches"
              className="text-indigo-600 hover:underline font-medium"
            >
              {t("viewMatches", {}, {})} →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
