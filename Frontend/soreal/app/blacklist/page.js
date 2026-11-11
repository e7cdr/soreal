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
import { useTranslation } from "@/app/components/LanguageProvider";

export default function BlacklistPage() {
  const { t } = useTranslation();
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

  useEffect(() => {
    checkAccess();
  }, []);

  async function checkAccess() {
    const existingToken = localStorage.getItem("blacklist_access_token");

    try {
      await fetchBlacklist({ page: 1 });
      setLocked(false);
      loadData();
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

  const handleFilterChange = (name, value) => {
    setFilters((prev) => ({ ...prev, [name]: value }));
    setPage(1);
  };

  const handleUnlock = async (password) => {
    try {
      await unlockBlacklist(password);
      await setAccessToken(password);
      setLocked(false);
      loadData();
    } catch (err) {
      throw err;
    }
  };

  if (loading) return <div className="p-6">{t("loading")}</div>;

  if (locked) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">{t("blacklist")}</h1>
        <UnlockForm onUnlock={handleUnlock} />
      </div>
    );
  }

  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">{t("blacklist")}</h1>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-50 p-4 rounded">
            <div className="text-gray-500 text-sm">{t("totalCases")}</div>
            <div className="text-xl font-bold">{stats.total}</div>
          </div>
          <div className="bg-gray-50 p-4 rounded">
            <div className="text-gray-500 text-sm">{t("thisMonth")}</div>
            <div className="text-xl font-bold">{stats.this_month}</div>
          </div>
          <div className="bg-gray-50 p-4 rounded">
            <div className="text-gray-500 text-sm">{t("verified")}</div>
            <div className="text-xl font-bold">
              {stats.by_status?.verified || 0}
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <button
          onClick={() => {
            exportBlacklistCSV().then((resp) => {
              const url = window.URL.createObjectURL(
                new Blob([resp.body])
              );
              const a = document.createElement("a");
              a.href = url;
              a.download = "blacklist_export.csv";
              a.click();
              window.URL.revokeObjectURL(url);
            }).catch((err) => {
              alert(err.message || t("error"));
            });
          }}
          className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 text-sm font-medium"
        >
          {t("exportCSV")}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

      {cases.length > 0 && (
        <div className="mt-6">
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
