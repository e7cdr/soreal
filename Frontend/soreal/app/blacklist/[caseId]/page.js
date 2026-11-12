"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/app/components/LanguageProvider";
import PageShell from "@/app/components/PageShell";
import UnlockForm from "@/app/components/UnlockForm";
import { fetchBlacklistPerson, unlockBlacklist, setAccessToken } from "@/lib/api";

export default function BlacklistDetailPage({ params }) {
  const { translate: t } = useTranslation();
  const caseId = Array.isArray(params.caseId) ? params.caseId[0] : params.caseId;
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [locked, setLocked] = useState(false);
  const [unlockError, setUnlockError] = useState("");

  useEffect(() => {
    checkAccess();
  }, [caseId]);

  async function checkAccess() {
    const existingToken = localStorage.getItem("blacklist_access_token");
    setLoading(true);
    try {
      const data = await fetchBlacklistPerson(caseId);
      setCaseData(data);
      setLocked(false);
    } catch (err) {
      if (err.message.includes("403") || err.message.includes("401")) {
        setLocked(!!existingToken);
      } else if (!existingToken) {
        setLocked(true);
      } else {
        setError(err.message || t("error"));
      }
    } finally {
      setLoading(false);
    }
  }

  const handleUnlock = async (password) => {
    setUnlockError("");
    try {
      await unlockBlacklist(password);
      await setAccessToken(password);
      setLocked(false);
      await checkAccess();
    } catch (err) {
      setUnlockError(err.message || t("invalidPassword"));
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

  if (error || !caseData) {
    return (
      <PageShell title={t("blacklist")}>
        <div className="compact-card text-sm text-red-600">
          {error || t("notFound")}
        </div>
      </PageShell>
    );
  }

  const statusLabel = t(caseData.status);
  const categoryLabel = t(caseData.category);
  const riskLabel = t(caseData.risk_level);
  const idTypeLabel = t(caseData.id_type);

  return (
    <PageShell title={t("blacklist")} eyebrow={caseData.full_name || t("name")}>
      <div className="flex justify-between items-start mb-3">
        <h1 className="text-xl font-bold">{caseData.full_name || t("name")}</h1>
        <span className="text-xs font-mono bg-[var(--surface-muted)] px-2 py-1 rounded">
          {caseData.case_id}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div className="compact-card p-3">
          <div className="text-xs text-[var(--text-muted)]">{t("status")}</div>
          <div className="font-medium">{statusLabel}</div>
        </div>
        <div className="compact-card p-3">
          <div className="text-xs text-[var(--text-muted)]">{t("category")}</div>
          <div className="font-medium">{categoryLabel}</div>
        </div>
        <div className="compact-card p-3">
          <div className="text-xs text-[var(--text-muted)]">{t("riskLevel")}</div>
          <div className="font-medium">{riskLabel}</div>
        </div>
        <div className="compact-card p-3">
          <div className="text-xs text-[var(--text-muted)]">{t("idType")}</div>
          <div className="font-medium">{idTypeLabel}</div>
        </div>
        <div className="compact-card p-3">
          <div className="text-xs text-[var(--text-muted)]">{t("idNumber")}</div>
          <div className="font-medium">{caseData.masked_id || "—"}</div>
        </div>
        <div className="compact-card p-3">
          <div className="text-xs text-[var(--text-muted)]">{t("nationality")}</div>
          <div className="font-medium">{caseData.nationality || "—"}</div>
        </div>
      </div>

      {caseData.incident_location && (
        <div className="mb-4">
          <h2 className="text-sm font-semibold mb-1">{t("incidentLocation")}</h2>
          <p className="text-sm text-[var(--text-muted)]">{caseData.incident_location}</p>
        </div>
      )}

      {caseData.incident_date && (
        <div className="mb-4">
          <h2 className="text-sm font-semibold mb-1">{t("incidentDate")}</h2>
          <p className="text-sm text-[var(--text-muted)]">
            {new Date(caseData.incident_date).toLocaleDateString()}
          </p>
        </div>
      )}

      {caseData.description && (
        <div className="mb-4">
          <h2 className="text-sm font-semibold mb-1">{t("description")}</h2>
          <div className="prose prose-sm max-w-none text-[var(--text-muted)]" dangerouslySetInnerHTML={{ __html: caseData.description }} />
        </div>
      )}

      {caseData.images?.length && (
        <div className="mb-4">
          <h2 className="text-sm font-semibold mb-2">{t("images")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {caseData.images.map((img, i) => (
              <div key={i} className="border rounded overflow-hidden">
                <img src={img.image_url} alt={img.caption || "Case image"} className="w-full h-40 object-cover" />
                {img.caption && <p className="p-2 text-xs text-[var(--text-muted)]">{img.caption}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-[var(--text-muted)] mt-4">
        {t("caseAdded")}:{" "}
        {new Date(caseData.created_at).toLocaleDateString()}
      </p>
    </PageShell>
  );
}
