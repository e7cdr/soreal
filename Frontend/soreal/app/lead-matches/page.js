"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  fetchLeadMatches,
  notifyLeadMatch,
  dismissLeadMatch,
} from "@/lib/api";
import { useTranslation } from "@/app/components/LanguageProvider";
import PageShell from "@/app/components/PageShell";

export default function LeadMatchesPage() {
  const { translate: t } = useTranslation();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadMatches() {
    setLoading(true);
    try {
      const data = await fetchLeadMatches();
      setMatches(data.results || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMatches();
  }, []);

  async function handleNotify(matchId) {
    try {
      await notifyLeadMatch(matchId);
      setMatches((prev) =>
        prev.map((m) =>
          m.id === matchId ? { ...m, status: "notified" } : m
        )
      );
    } catch (err) {
      setError(err.message || "Failed to notify");
    }
  }

  async function handleDismiss(matchId) {
    try {
      await dismissLeadMatch(matchId);
      setMatches((prev) =>
        prev.map((m) =>
          m.id === matchId ? { ...m, status: "dismissed" } : m
        )
      );
    } catch (err) {
      setError(err.message || "Failed to dismiss");
    }
  }

  if (loading) {
    return (
      <PageShell title={t("leadMatches")} description={t("leadMatchesDescription")}>
        <div className="compact-card text-sm text-[var(--text-muted)]">{t("loading")}</div>
      </PageShell>
    );
  }
  if (error) {
    return (
      <PageShell title={t("leadMatches")} description={t("leadMatchesDescription")}>
        <div className="compact-card text-sm text-red-600">{error}</div>
      </PageShell>
    );
  }

  const statusBadge = (status) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-800",
      notified: "bg-blue-100 text-blue-800",
      contacted: "bg-green-100 text-green-800",
      dismissed: "bg-gray-100 text-gray-800",
    };
    return (
      <span className={`rounded-full px-2 py-1 text-xs font-medium ${colors[status]}`}>
        {status}
      </span>
    );
  };

  return (
    <PageShell
      title={t("leadMatches")}
      description={t("leadMatchesDescription")}
      actions={(
        <Link href="/requests" className="toolbar-button">
          ← {t("backToRequests")}
        </Link>
      )}
    >
      {matches.length === 0 ? (
        <div className="compact-card py-10 text-center text-sm text-[var(--text-muted)]">
          {t("noMatches")}
        </div>
      ) : (
        <div className="table-scroll">
          <table className="w-full min-w-[860px] border-collapse text-left text-sm">
            <thead className="bg-[var(--surface-muted)] text-xs uppercase text-[var(--text-muted)]">
              <tr>
                <th className="px-3 py-2">{t("lead")}</th>
                <th className="px-3 py-2">{t("phone")}</th>
                <th className="px-3 py-2">{t("property")}</th>
                <th className="px-3 py-2">{t("score")}</th>
                <th className="px-3 py-2">{t("reasons")}</th>
                <th className="px-3 py-2">{t("status")}</th>
                <th className="px-3 py-2">{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((m) => (
                <tr key={m.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2 font-medium">{m.lead_name}</td>
                  <td className="px-3 py-2">{m.lead_phone}</td>
                  <td className="px-3 py-2">
                    <Link href={`/estates/${m.property_slug}`} className="font-semibold text-[var(--green)] hover:underline">
                      {m.property_title}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-mono">{m.match_score}</span>
                  </td>
                  <td className="px-3 py-2 text-xs">{m.match_reasons}</td>
                  <td className="px-3 py-2">{statusBadge(m.status)}</td>
                  <td className="px-3 py-2">
                    {m.status === "pending" && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleNotify(m.id)}
                          className="toolbar-button toolbar-button-primary"
                        >
                          {t("notify")}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDismiss(m.id)}
                          className="toolbar-button"
                        >
                          {t("dismiss")}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
