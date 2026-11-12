"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, Users, X, RefreshCw } from "lucide-react";
import { fetchLeadDuplicates } from "@/lib/api";
import { useTranslation } from "@/app/components/LanguageProvider";
import PageShell from "@/app/components/PageShell";

const PAGE_SIZE = 20;

export default function DuplicatesPage() {
  const { translate: t } = useTranslation();
  const [groups, setGroups] = useState([]);
  const [totalGroups, setTotalGroups] = useState(0);
  const [totalDupeLeads, setTotalDupeLeads] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [draftQuery, setDraftQuery] = useState("");

  const loadDuplicates = useCallback(async () => {
    setError("");
    try {
      const data = await fetchLeadDuplicates();
      let filtered = data.groups || [];
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        filtered = filtered.filter((g) =>
          g.leads.some(
            (l) =>
              l.name.toLowerCase().includes(q) ||
              l.phone.includes(q) ||
              g.key.includes(q)
          )
        );
      }
      setGroups(filtered);
      setTotalGroups(data.total_groups || 0);
      setTotalDupeLeads(data.total_duplicate_leads || 0);
    } catch (err) {
      setError(err.message || t("error"));
    } finally {
      setLoading(false);
    }
  }, [query, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDuplicates();
  }, [loadDuplicates]);

  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(groups.length / PAGE_SIZE));
  const pageGroups = groups.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <PageShell
      eyebrow={t("whatsappImport")}
      title={t("duplicateFinder")}
      description={t("duplicateFinderDescription")}
      actions={(
        <><button type="button" onClick={loadDuplicates} className="toolbar-button"><RefreshCw size={15} /></button></>
      )}
      toolbar={(
        <>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setQuery(draftQuery.trim());
              setPage(1);
            }}
            className="toolbar-search"
          >
            <Search size={15} />
            <input
              value={draftQuery}
              onChange={(event) => setDraftQuery(event.target.value)}
              placeholder={t("searchDuplicates")}
              aria-label={t("searchDuplicates")}
            />
          </form>
          <span className="page-toolbar-spacer" />
          <span className="page-toolbar-label">{totalGroups} {t("duplicateGroups")} \u00b7 {totalDupeLeads} {t("duplicateLeads")}</span>
        </>
      )}
      footer={pageCount > 1 ? (
        <div className="flex w-full items-center justify-between gap-3">
          <button type="button" disabled={page <= 1} onClick={() => setPage((v) => v - 1)} className="toolbar-button disabled:opacity-40">{t("previous")}</button>
          <span className="text-sm text-[var(--text-muted)]">{t("pageOf", { page, pageCount })}</span>
          <button type="button" disabled={page >= pageCount} onClick={() => setPage((v) => v + 1)} className="toolbar-button disabled:opacity-40">{t("next")}</button>
        </div>
      ) : null}
    >
      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700">{error}</div>
      )}
      {loading ? (
        <div className="compact-card text-center text-sm text-[var(--text-muted)]">{t("loading")}</div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-10 text-center">
          <Users className="mx-auto mb-3 text-[var(--green)]" size={28} />
          <h2 className="font-semibold">{t("noDuplicates")}</h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">{t("noDuplicatesDescription")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pageGroups.map((group) => (
            <article key={group.key} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <h3 className="text-sm font-semibold">{group.count} {t("possibleDuplicates")}</h3>
                  <p className="text-xs text-[var(--text-muted)]" title={group.key}>{group.key}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {}}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:border-[var(--green)]"
                >
                  {t("reviewDuplicates")}
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-4">
                {group.leads.map((lead) => (
                  <div key={lead.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/50 p-3 text-sm">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="font-semibold truncate max-w-[120px]">{lead.name}</span>
                      <span className="text-xs text-[var(--text-muted)]">#{lead.id}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mb-2">
                      <span className="font-mono">{lead.phone || t("noPhone")}</span>
                      <span className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5">{t("leadStatus_" + lead.status)}</span>
                    </div>
                    {lead.broker_id && (
                      <div className="text-xs text-[var(--green)] font-medium">{t("linkedToBroker")}</div>
                    )}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </PageShell>
  );
}
