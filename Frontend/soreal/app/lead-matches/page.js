"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  fetchLeadMatches,
  notifyLeadMatch,
  dismissLeadMatch,
} from "@/lib/api";
import { useTranslation } from "@/app/components/LanguageProvider";

export default function LeadMatchesPage() {
  const { t } = useTranslation();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadMatches();
  }, []);

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

  if (loading) return <div className="p-6">{t("loading")}</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  const statusBadge = (status) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-800",
      notified: "bg-blue-100 text-blue-800",
      contacted: "bg-green-100 text-green-800",
      dismissed: "bg-gray-100 text-gray-800",
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status]}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{t("leadMatches", {}, {})}</h1>
        <Link
          href="/leads"
          className="text-blue-600 hover:underline text-sm"
        >
          ← {t("backToLeads", {}, {})}
        </Link>
      </div>

      <p className="text-gray-600 mb-6">
        {t("leadMatchesDescription", {}, {})}
      </p>

      {matches.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No matches yet. When a new lead or property is added, matches
          will appear here automatically.
        </div>
      )}

      {matches.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b text-left">
                <th className="p-3">{t("lead")}</th>
                <th className="p-3">{t("phone")}</th>
                <th className="p-3">{t("property")}</th>
                <th className="p-3">Score</th>
                <th className="p-3">Reasons</th>
                <th className="p-3">{t("status")}</th>
                <th className="p-3">{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((m) => (
                <tr key={m.id} className="border-b">
                  <td className="p-3">{m.lead_name}</td>
                  <td className="p-3">{m.lead_phone}</td>
                  <td className="p-3">
                    <Link href={`/estates/${m.property_slug}`}>
                      {m.property_title}
                    </Link>
                  </td>
                  <td className="p-3">
                    <span className="font-mono">{m.match_score}</span>
                  </td>
                  <td className="p-3 text-sm">{m.match_reasons}</td>
                  <td className="p-3">{statusBadge(m.status)}</td>
                  <td className="p-3">
                    {m.status === "pending" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleNotify(m.id)}
                          className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                        >
                          {t("notify", {}, {})}
                        </button>
                        <button
                          onClick={() => handleDismiss(m.id)}
                          className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                        >
                          {t("dismiss", {}, {})}
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
    </div>
  );
}
