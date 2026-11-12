"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useTranslation } from "@/app/components/LanguageProvider";
import PageShell from "@/app/components/PageShell";

const EMPTY_RECORD = { name: "", phone: "", email: "", company: "", identification: "", notes: "" };

export default function RecordsDirectory({ title, singular, loadRecords, fetchRecord, createRecord, updateRecord, includeIdentification = false }) {
  const { translate: t } = useTranslation();
  const [records, setRecords] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await loadRecords({ q: query, page });
      setRecords(response.results || []);
      setCount(response.count || 0);
    } catch (loadError) {
      setError(loadError.message || t("error"));
    } finally {
      setLoading(false);
    }
  }, [loadRecords, page, query, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    const recordId = new URLSearchParams(window.location.search).get("record");
    if (recordId) {
      fetchRecord(recordId)
        .then((record) => setDraft({ ...EMPTY_RECORD, ...record }))
        .catch((loadError) => setError(loadError.message || t("error")));
    }
  }, [fetchRecord, t]);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (draft.id) await updateRecord(draft.id, draft);
      else await createRecord(draft);
      setDraft(null);
      await load();
    } catch (saveError) {
      setError(saveError.message || t("error"));
    } finally {
      setSaving(false);
    }
  }

  const pageCount = Math.max(1, Math.ceil(count / 20));
  const fields = [
    ["name", t(singular === "owner" ? "ownerName" : "brokerName")],
    ["phone", t("phone")],
    ["email", t("email")],
    ["company", t("company")],
    ...(includeIdentification ? [["identification", t("identification")]] : []),
    ["notes", t("notes")],
  ];

  return (
    <PageShell
      eyebrow={t("estateManagement")}
      title={title}
      actions={(
        <button type="button" onClick={() => setDraft({ ...EMPTY_RECORD })} className="toolbar-button toolbar-button-primary">
          <Plus size={16} /> {t("addRecord")}
        </button>
      )}
      toolbar={(
        <>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setQuery(search);
              setPage(1);
            }}
            className="toolbar-search"
          >
            <Search size={15} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("searchDirectory")}
              aria-label={t("searchDirectory")}
            />
          </form>
          <span className="page-toolbar-spacer" />
          <span className="page-toolbar-label">{count} {t("records")}</span>
        </>
      )}
      footer={pageCount > 1 ? (
        <div className="flex w-full items-center justify-between gap-3">
          <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="toolbar-button disabled:opacity-40">{t("previous")}</button>
          <span className="text-sm text-[var(--text-muted)]">{t("pageOf", { page, pageCount })}</span>
          <button type="button" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)} className="toolbar-button disabled:opacity-40">{t("next")}</button>
        </div>
      ) : null}
    >
      {error && <p role="alert" className="mb-3 rounded-lg border border-red-300 bg-red-50 p-2.5 text-sm text-red-700">{error}</p>}

      <div className="table-scroll">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="bg-[var(--surface-muted)] text-xs uppercase text-[var(--text-muted)]">
            <tr>{[t(singular === "owner" ? "ownerName" : "brokerName"), t("phone"), t("email"), t("company"), t("linkedRecords"), ""].map((heading, index) => <th key={`${heading}-${index}`} className="px-3 py-2">{heading}</th>)}</tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className="p-8 text-center text-[var(--text-muted)]">{t("loading")}</td></tr>
              : records.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-[var(--text-muted)]">{t("noRecords")}</td></tr>
                : records.map((record) => (
                  <tr key={record.id} className="border-t border-[var(--border)]">
                    <td className="px-3 py-2 font-semibold">{record.name}</td>
                    <td className="px-3 py-2">{record.phone || "—"}</td>
                    <td className="px-3 py-2">{record.email || "—"}</td>
                    <td className="px-3 py-2">{record.company || "—"}</td>
                    <td className="px-3 py-2">
                      {record.property_count || 0} {t("estates").toLowerCase()} ·{" "}
                      {singular === "owner"
                        ? `${record.project_count || 0} ${t("projects").toLowerCase()}`
                        : `${record.request_count || 0} ${t("requests").toLowerCase()}`}
                    </td>
                    <td className="px-3 py-2 text-right"><button type="button" onClick={() => setDraft({ ...EMPTY_RECORD, ...record })} className="font-semibold text-[var(--green)] hover:underline">{t("edit")}</button></td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {draft && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <form onSubmit={submit} className="my-4 grid w-full max-w-2xl gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl sm:grid-cols-2">
            <div className="flex items-center justify-between gap-3 sm:col-span-2">
              <h2 className="text-lg font-semibold">{draft.id ? t("editRecord") : t("addRecord")}</h2>
              <button type="button" onClick={() => setDraft(null)} className="toolbar-button">{t("close")}</button>
            </div>
            {error && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-2.5 text-sm text-red-700 sm:col-span-2">{error}</p>}
            {fields.map(([field, label]) => (
              <label key={field} className={`filter-field ${field === "notes" ? "sm:col-span-2" : ""}`}>
                <span>{label}</span>
                {field === "notes" ? (
                  <textarea rows={3} value={draft[field] || ""} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })} />
                ) : (
                  <input required={field === "name"} type={field === "email" ? "email" : "text"} value={draft[field] || ""} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })} />
                )}
              </label>
            ))}
            <div className="flex justify-end gap-2 sm:col-span-2">
              <button type="button" onClick={() => setDraft(null)} className="toolbar-button">{t("cancel")}</button>
              <button disabled={saving} className="toolbar-button toolbar-button-primary disabled:opacity-50">{saving ? t("saving") : t("saveChanges")}</button>
            </div>
          </form>
        </div>
      )}
    </PageShell>
  );
}
