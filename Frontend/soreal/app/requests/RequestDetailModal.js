"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, X } from "lucide-react";
import { fetchBrokers, fetchLead, updateLead } from "@/lib/api";
import { DOMINICAN_CITIES, DOMINICAN_PROVINCES } from "@/lib/locations";
import { useTranslation } from "@/app/components/LanguageProvider";

const FIELD_CLASS =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]";

function nullableNumber(value) {
  return value === "" || value == null ? null : Number(value);
}

export default function RequestDetailModal({ leadId, onClose, onSaved }) {
  const { translate: t } = useTranslation();
  const [lead, setLead] = useState(null);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [brokers, setBrokers] = useState([]);

  const loadLead = useCallback(async () => {
    try {
      const data = await fetchLead(leadId);
      setLead(data);
      setDraft(data);
    } catch (loadError) {
      setError(loadError.message || t("error"));
    }
  }, [leadId, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadLead();
  }, [loadLead]);

  useEffect(() => {
    fetchBrokers()
      .then((response) => setBrokers(response.results || []))
      .catch((loadError) => setError(loadError.message || t("error")));
  }, [t]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function change(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const updated = await updateLead(leadId, {
        name: draft.name,
        phone: draft.phone,
        status: draft.status,
        property_type: draft.property_type || null,
        listing_type: draft.listing_type,
        min_bedrooms: nullableNumber(draft.min_bedrooms),
        max_bedrooms: nullableNumber(draft.max_bedrooms),
        min_bathrooms: nullableNumber(draft.min_bathrooms),
        max_price: nullableNumber(draft.max_price),
        min_price: nullableNumber(draft.min_price),
        preferred_location: draft.preferred_location,
        city: draft.city,
        province: draft.province,
        broker: draft.broker || null,
      });
      setLead(updated);
      setDraft(updated);
      onSaved(updated);
    } catch (saveError) {
      setError(saveError.message || t("error"));
    } finally {
      setSaving(false);
    }
  }

  function selectField(label, field, options) {
    const ignoredStatus = field === "status" && draft.status === "ignored";
    return (
      <label className="block text-sm">
        <span className="mb-1 block font-medium">{label}</span>
        <select
          disabled={ignoredStatus}
          value={draft[field] ?? ""}
          onChange={(event) => change(field, event.target.value)}
          className={FIELD_CLASS}
        >
          <option value="">—</option>
          {ignoredStatus && <option value="ignored">{t("leadStatus_ignored")}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3 sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="request-modal-title"
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[var(--border)] p-5">
          <div>
            <p className="text-sm font-semibold text-[var(--green)]">{t("requestDetails")}</p>
            <h2 id="request-modal-title" className="mt-1 text-xl font-bold">
              {lead?.name || t("unknownRequester")}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label={t("close")} className="rounded-lg p-2 hover:bg-[var(--surface-muted)]">
            <X size={20} />
          </button>
        </header>

        {!draft ? (
          <div className="p-8 text-center text-sm text-[var(--text-muted)]">{error || t("loading")}</div>
        ) : (
          <form onSubmit={save} className="overflow-y-auto p-5">
            {error && <p role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">{t("requester")}</span>
                <input value={draft.name || ""} onChange={(event) => change("name", event.target.value)} className={FIELD_CLASS} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">{t("phone")}</span>
                <input value={draft.phone || ""} onChange={(event) => change("phone", event.target.value)} className={FIELD_CLASS} />
              </label>
              {selectField(t("status"), "status", [
                { value: "new", label: t("leadStatus_new") },
                { value: "contacted", label: t("leadStatus_contacted") },
                { value: "matched", label: t("leadStatus_matched") },
                { value: "completed", label: t("leadStatus_completed") },
                { value: "unavailable", label: t("leadStatus_unavailable") },
                { value: "ignored", label: t("leadStatus_ignored") },
                { value: "closed", label: t("leadStatus_closed") },
              ])}
              {selectField(t("propertyType"), "property_type", ["apartment", "house", "villa", "land", "commercial"].map((value) => ({ value, label: t(value) })))}
              {selectField(t("brokerName"), "broker", [
                { value: "", label: t("noBrokerLinked") },
                ...(draft.broker && !brokers.some((broker) => broker.id === draft.broker) ? [{ value: draft.broker, label: draft.broker_name || t("broker") }] : []),
                ...brokers.map((broker) => ({ value: broker.id, label: broker.name })),
              ])}
              {selectField(t("listingType"), "listing_type", [
                { value: "any", label: t("anyListingType") },
                { value: "rent", label: t("listing_rent") },
                { value: "sale", label: t("listing_sale") },
              ])}
              <label className="block text-sm">
                <span className="mb-1 block font-medium">{t("minBedrooms")}</span>
                <input type="number" min="0" value={draft.min_bedrooms ?? ""} onChange={(event) => change("min_bedrooms", event.target.value)} className={FIELD_CLASS} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">{t("minBathrooms")}</span>
                <input type="number" min="0" value={draft.min_bathrooms ?? ""} onChange={(event) => change("min_bathrooms", event.target.value)} className={FIELD_CLASS} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">{t("minPrice")}</span>
                <input type="number" min="0" step="0.01" value={draft.min_price ?? ""} onChange={(event) => change("min_price", event.target.value)} className={FIELD_CLASS} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">{t("maxPrice")}</span>
                <input type="number" min="0" step="0.01" value={draft.max_price ?? ""} onChange={(event) => change("max_price", event.target.value)} className={FIELD_CLASS} />
              </label>
              {selectField(t("province"), "province", [
                ...(draft.province && !DOMINICAN_PROVINCES.includes(draft.province) ? [{ value: draft.province, label: draft.province }] : []),
                ...DOMINICAN_PROVINCES.map((value) => ({ value, label: value })),
              ])}
              {selectField(t("city"), "city", [
                ...(draft.city && !DOMINICAN_CITIES.includes(draft.city) ? [{ value: draft.city, label: draft.city }] : []),
                ...DOMINICAN_CITIES.map((value) => ({ value, label: value })),
              ])}
            </div>
            <label className="mt-4 block text-sm">
              <span className="mb-1 block font-medium">{t("location")}</span>
              <input value={draft.preferred_location || ""} onChange={(event) => change("preferred_location", event.target.value)} className={FIELD_CLASS} />
            </label>
            <label className="mt-4 block text-sm">
              <span className="mb-1 block font-medium">{t("originalRequest")}</span>
              <textarea readOnly value={(draft.notes || "").replace(/^WhatsApp request:\s*/, "")} rows={6} className={`${FIELD_CLASS} resize-y`} />
            </label>
            <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
              <Link href={`/requests/${leadId}`} onClick={onClose} className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--green)] hover:underline">
                {t("fullRequestRecord")} <ExternalLink size={15} />
              </Link>
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold">{t("cancel")}</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-[var(--green)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  {saving ? t("saving") : t("saveChanges")}
                </button>
              </div>
            </footer>
          </form>
        )}
      </section>
    </div>
  );
}
