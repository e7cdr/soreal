"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useTranslation } from "@/app/components/LanguageProvider";
import PageShell from "@/app/components/PageShell";
import StatStrip from "@/app/components/StatStrip";
import { fetchDataQualitySummary } from "@/lib/api";

export default function DataQualityPage() {
  const { translate: t } = useTranslation();
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchDataQualitySummary().then(setReport).catch((loadError) => setError(loadError.message || t("error")));
  }, [t]);

  const names = ["estate", "project", "request", "broker", "owner"];
  const total = Object.values(report?.incomplete_counts || {}).reduce((sum, count) => sum + count, 0);

  return (
    <PageShell
      eyebrow={t("estateManagement")}
      title={t("dataQuality")}
      description={t("dataQualityDescription")}
    >
      {error && <p role="alert" className="mb-3 rounded-lg border border-red-300 bg-red-50 p-2.5 text-sm text-red-700">{error}</p>}
      {!report ? <p className="compact-card text-center text-sm text-[var(--text-muted)]">{error ? "" : t("loading")}</p> : (
        <div className="space-y-3">
          <div className={`flex items-center gap-3 rounded-xl border p-3 ${total ? "border-amber-300 bg-amber-50 text-amber-900" : "border-green-300 bg-green-50 text-green-900"}`}>
            {total ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
            <div>
              <p className="text-sm font-semibold">{total ? t("incompleteRecordsCount", { count: total }) : t("allRecordsComplete")}</p>
              <p className="text-xs opacity-80">{t("auditChecksNotice")}</p>
            </div>
          </div>

          <StatStrip
            items={names.map((name) => ({
              label: t(name === "estate" ? "estates" : name === "project" ? "projects" : name === "request" ? "requests" : `${name}s`),
              value: report.incomplete_counts[name] || 0,
              sub: t("recordsNeedAttention"),
            }))}
          />

          <div className="table-scroll">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-[var(--surface-muted)] text-xs uppercase text-[var(--text-muted)]"><tr><th className="px-3 py-2">{t("record")}</th><th className="px-3 py-2">{t("recordType")}</th><th className="px-3 py-2">{t("missingFields")}</th><th className="px-3 py-2"></th></tr></thead>
              <tbody>{report.records.map((record) => <tr key={`${record.entity}-${record.id}`} className="border-t border-[var(--border)]">
                <td className="px-3 py-2 font-semibold">{record.name || `${t(record.entity)} #${record.id}`}</td>
                <td className="px-3 py-2">{t(record.entity)}</td>
                <td className="px-3 py-2">{record.missing_fields.map((field) => t(`audit_${field}`)).join(", ")}</td>
                <td className="px-3 py-2 text-right"><Link href={record.url} className="font-semibold text-[var(--green)] hover:underline">{t("reviewRecord")}</Link></td>
              </tr>)}</tbody>
            </table>
            {report.records.length === 0 && <p className="p-8 text-center text-sm text-[var(--text-muted)]">{t("allRecordsComplete")}</p>}
          </div>
          {total > report.records.length && <p className="text-xs text-[var(--text-muted)]">{t("auditRowsLimit", { count: report.records.length })}</p>}
        </div>
      )}
    </PageShell>
  );
}
