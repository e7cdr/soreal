"use client";

import { useState, useEffect } from "react";
import {
  fetchBlacklist,
  fetchBlacklistStats,
  unlockBlacklist,
  setAccessToken,
  exportBlacklistCSV,
} from "@/lib/api";
import BlacklistCard from "@/app/components/BlacklistCard";
import EmptyState from "@/app/components/EmptyState";
import Pagination from "@/app/components/Pagination";
import UnlockForm from "@/app/components/UnlockForm";
import PageShell from "@/app/components/PageShell";
import StatStrip from "@/app/components/StatStrip";
import FilterPopover from "@/app/components/FilterPopover";
import { useTranslation } from "@/app/components/LanguageProvider";

export default function BlacklistPage() {
  const { translate: t } = useTranslation();
  const [cases, setCases] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [locked, setLocked] = useState(false);
  const [filters, setFilters] = useState({
    q: "",
    status: "",
    category: "",
    date_from: "",
    date_to: "",
  });

  async function checkAccess() {
    const existingToken = localStorage.getItem("blacklist_access_token");

    try {
      await fetchBlacklist({ page: 1 });
      setLocked(false);
    } catch (err) {
      if (err.message.includes("403") || err.message.includes("401")) {
        setLocked(true);
      } else if (!existingToken) {
        setLocked(true);
      }
      setLoading(false);
    }
  }

  async function loadData() {
    setLoading(true);
    try {
      const [listData, statsData] = await Promise.all([
        fetchBlacklist({ ...filters, page }),
        fetchBlacklistStats(),
      ]);
      setCases(listData.results || []);
      setTotalPages(Math.ceil((listData.count || 0) / 20));
      setStats(statsData);
    } catch (err) {
      if (err.message.includes("403") || err.message.includes("401")) {
        setLocked(true);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkAccess();
  }, []);

  useEffect(() => {
    if (!locked) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadData();
    }
  }, [filters, page, locked]);

  const handleFilterChange = (name, value) => {
    setFilters((prev) => ({ ...prev, [name]: value }));
    setPage(1);
  };

  const handleUnlock = async (password) => {
    try {
      await unlockBlacklist(password);
      await setAccessToken(password);
      setLocked(false);
    } catch (err) {
      throw err;
    }
  };

  if (loading) {
    return (
      <PageShell title={t("blacklist")}>
        <div className="compact-card text-sm text-[var(--text-muted)]">{t("loading")}</div>
      </PageShell>
    );
  }

  if (locked) {
    return (
      <PageShell title={t("blacklist")}>
        <UnlockForm onUnlock={handleUnlock} />
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell title={t("blacklist")}>
        <div className="compact-card text-sm text-red-600">{error}</div>
      </PageShell>
    );
  }

  const activeFilters = Object.values(filters).filter(Boolean).length;
  const exportCsv = () => {
    exportBlacklistCSV()
      .then((resp) => {
        const url = window.URL.createObjectURL(new Blob([resp.body]));
        const a = document.createElement("a");
        a.href = url;
        a.download = "blacklist_export.csv";
        a.click();
        window.URL.revokeObjectURL(url);
      })
      .catch((err) => {
        alert(err.message || t("error"));
      });
  };

  return (
    <PageShell
      title={t("blacklist")}
      actions={(
        <button type="button" onClick={exportCsv} className="toolbar-button">
          {t("exportCSV")}
        </button>
      )}
      toolbar={(
        <>
          <FilterPopover label={t("filters")} count={activeFilters} closeLabel={t("close")}>
            <div className="filter-popover-grid">
              <label className="filter-field md:col-span-2">
                <span>{t("search")}</span>
                <input
                  value={filters.q}
                  onChange={(event) => handleFilterChange("q", event.target.value)}
                />
              </label>
              <label className="filter-field">
                <span>{t("status")}</span>
                <select
                  value={filters.status}
                  onChange={(event) => handleFilterChange("status", event.target.value)}
                >
                  <option value="">—</option>
                  {["reported", "under_review", "verified", "disputed", "resolved", "archived"].map((value) => (
                    <option key={value} value={value}>{value.replace("_", " ")}</option>
                  ))}
                </select>
              </label>
              <label className="filter-field">
                <span>{t("category")}</span>
                <select
                  value={filters.category}
                  onChange={(event) => handleFilterChange("category", event.target.value)}
                >
                  <option value="">—</option>
                  {["fraud", "unpaid_rent", "property_damage", "scam", "assault", "other"].map((value) => (
                    <option key={value} value={value}>{value.replace("_", " ")}</option>
                  ))}
                </select>
              </label>
              <label className="filter-field">
                <span>{t("dateFrom")}</span>
                <input
                  type="date"
                  value={filters.date_from}
                  onChange={(event) => handleFilterChange("date_from", event.target.value)}
                />
              </label>
              <label className="filter-field">
                <span>{t("dateTo")}</span>
                <input
                  type="date"
                  value={filters.date_to}
                  onChange={(event) => handleFilterChange("date_to", event.target.value)}
                />
              </label>
            </div>
            <button
              type="button"
              className="toolbar-button"
              onClick={() => {
                setFilters({ q: "", status: "", category: "", date_from: "", date_to: "" });
                setPage(1);
              }}
            >
              {t("clearFilters")}
            </button>
          </FilterPopover>
          <span className="page-toolbar-spacer" />
          <span className="page-toolbar-label">{stats?.total ?? 0} {t("totalCases")}</span>
        </>
      )}
      footer={totalPages > 1 ? (
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      ) : null}
    >
      {stats && (
        <StatStrip
          items={[
            { label: t("totalCases"), value: stats.total },
            { label: t("thisMonth"), value: stats.this_month },
            { label: t("verified"), value: stats.by_status?.verified || 0 },
          ]}
        />
      )}

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {cases.length === 0 ? (
          <EmptyState
            title={t("noCasesFound")}
            message={t("tryAdjustingFilters")}
          />
        ) : (
          cases.map((c) => (
            <BlacklistCard key={c.case_id} case={c} />
          ))
        )}
      </div>
    </PageShell>
  );
}
