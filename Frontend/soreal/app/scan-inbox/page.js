"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, FilePlus2, Search, X } from "lucide-react";
import { fetchScanInbox, processScanInboxItem } from "@/lib/api";
import { useTranslation } from "@/app/components/LanguageProvider";
import PageShell from "@/app/components/PageShell";

const FILTERS = ["pending", "all", "dismissed"];
const PAGE_SIZE = 20;

export default function ScanInboxPage() {
  const { translate: t } = useTranslation();
  const [filter, setFilter] = useState("pending");
  const [query, setQuery] = useState("");
  const [draftQuery, setDraftQuery] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeLink, setNoticeLink] = useState(null);

  const loadInbox = useCallback(async () => {
    setError("");
    try {
      const response = await fetchScanInbox({ status: filter, q: query, page });
      setItems(response.results || []);
      setCount(response.count || 0);
    } catch (loadError) {
      setError(loadError.message || t("error"));
    }
  }, [filter, page, query, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadInbox();
  }, [loadInbox]);

  async function processItem(item, action) {
    setBusyId(item.id);
    setError("");
    setNotice("");
    setNoticeLink(null);
    try {
      let payload = {};
      if (action === "save_as_estate") {
        const suggestion = item.suggested_request || {};
        const propertyType = suggestion.property_type || "apartment";
        const location = suggestion.preferred_location || "";
        payload = {
          title: `${t(propertyType)}${location ? ` · ${location}` : ` · ${item.sender || t("scannedMessage")}`}`,
          description: item.message,
          property_type: propertyType,
          listing_type: suggestion.listing_type === "rent" ? "rent" : "sale",
          price: suggestion.max_price ?? suggestion.min_price ?? null,
          currency: suggestion.budget_currency || "USD",
          bedrooms: suggestion.min_bedrooms ?? null,
          bathrooms: suggestion.min_bathrooms ?? null,
          address: location,
          status: "draft",
        };
      }
      const result = await processScanInboxItem(item.id, action, payload);
      if (filter === "pending") {
        setItems((current) => current.filter((entry) => entry.id !== item.id));
        setCount((current) => Math.max(0, current - 1));
      } else {
        await loadInbox();
      }
      const messageKey = {
        save_as_request: "scanSavedAsRequest",
        save_as_broker: "scanSavedAsBroker",
        save_as_estate: "scanSavedAsEstate",
        dismiss: "scanDismissed",
      }[action];
      setNotice(t(messageKey));
      if (action === "save_as_request" && result.id) {
        setNoticeLink({ href: `/requests/${result.id}`, label: t("openCreatedRequest") });
      } else if (action === "save_as_estate" && result.slug) {
        setNoticeLink({ href: `/estates/${result.slug}`, label: t("openCreatedEstate") });
      }
    } catch (actionError) {
      setError(actionError.message || t("error"));
    } finally {
      setBusyId(null);
    }
  }

  const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const pagination = pageCount > 1 ? (
    <div className="flex w-full items-center justify-between gap-3">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => setPage((current) => current - 1)}
        className="toolbar-button disabled:opacity-40"
      >
        {t("previous")}
      </button>
      <span className="text-sm text-[var(--text-muted)]">
        {t("pageOf", { page, pageCount })}
      </span>
      <button
        type="button"
        disabled={page >= pageCount}
        onClick={() => setPage((current) => current + 1)}
        className="toolbar-button disabled:opacity-40"
      >
        {t("next")}
      </button>
    </div>
  ) : null;

  return (
    <PageShell
      eyebrow={t("whatsappImport")}
      title={t("scanInbox")}
      description={t("scanInboxDescription")}
      actions={(
        <Link href="/whatsapp-import" className="toolbar-button">
          <FilePlus2 size={16} />
          {t("importWhatsAppChat")}
        </Link>
      )}
      toolbar={(
        <>
          <div className="toolbar-tabs" role="tablist" aria-label={t("scanInbox")}>
            {FILTERS.map((status) => (
              <button
                key={status}
                type="button"
                role="tab"
                aria-selected={filter === status}
                onClick={() => {
                  setFilter(status);
                  setPage(1);
                }}
                className={`toolbar-tab ${filter === status ? "toolbar-tab-active" : ""}`}
              >
                {t(`scanInbox_${status}`)}
              </button>
            ))}
          </div>

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
              placeholder={t("searchScanInbox")}
              aria-label={t("searchScanInbox")}
            />
          </form>

          <span className="page-toolbar-spacer" />
          <span className="page-toolbar-label">{count} {t("messages")}</span>
        </>
      )}
      footer={pagination}
    >
      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-3 rounded-lg border border-green-200 bg-green-50 p-2.5 text-sm text-green-800">
          {notice}{" "}
          {noticeLink && (
            <Link href={noticeLink.href} className="font-semibold underline">
              {noticeLink.label}
            </Link>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-10 text-center">
          <Check className="mx-auto mb-3 text-[var(--green)]" size={28} />
          <h2 className="font-semibold">{t("scanInboxEmpty")}</h2>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold">
                      {item.sender || t("unknownRequester")}
                    </h2>
                    <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-medium text-[var(--text-muted)]">
                      {t(`scanInboxStatus_${item.status}`)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {item.whatsapp_group} · {item.message_date} {item.message_time}
                  </p>
                </div>
                {item.status === "request" && item.lead_id && (
                  <Link href={`/requests/${item.lead_id}`} className="text-sm font-semibold text-[var(--green)] hover:underline">
                    {t("openCreatedRequest")}
                  </Link>
                )}
                {item.status === "estate" && item.property_id && item.property_slug && (
                  <Link href={`/estates/${item.property_slug}`} className="text-sm font-semibold text-[var(--green)] hover:underline">
                    {t("openCreatedEstate")}
                  </Link>
                )}
              </div>

              <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--foreground)]">
                {item.message || t("mediaOnlyMessage")}
              </p>
              {item.attachments?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-3">
                  {item.attachments.map((attachment) => (
                    <a
                      key={attachment.url}
                      href={attachment.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-[var(--green)] hover:underline"
                    >
                      {attachment.name}
                    </a>
                  ))}
                </div>
              )}

              {item.status === "pending" && (
                <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => processItem(item, "save_as_request")}
                    className="rounded-lg bg-[var(--green)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {t("saveAsRequest")}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === item.id || !item.sender}
                    onClick={() => processItem(item, "save_as_broker")}
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold hover:border-[var(--green)] disabled:opacity-50"
                  >
                    {t("saveAsBroker")}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => processItem(item, "save_as_estate")}
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold hover:border-[var(--green)] disabled:opacity-50"
                  >
                    {t("saveAsEstate")}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => processItem(item, "dismiss")}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--text-muted)] hover:border-red-400 hover:text-red-700 disabled:opacity-50"
                  >
                    <X size={15} />
                    {t("dismissScanItem")}
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

    </PageShell>
  );
}
