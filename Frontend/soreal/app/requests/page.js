"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  Clock3,
  Download,
  FileSpreadsheet,
  LayoutGrid,
  List,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  UserPlus,
  UserRoundX,
  X,
} from "lucide-react";
import {
  createBroker,
  createEstateFromLead,
  createOwner,
  downloadLeadExport,
  fetchBrokerCandidates,
  fetchLeads,
  fetchLeadSummary,
  rescanLeadBrokerLinks,
  saveBrokerCandidates,
  ignoreLeadUser,
  unignoreLeadUser,
  updateLeadStatus,
  updateLead,
} from "@/lib/api";
import { useTranslation } from "@/app/components/LanguageProvider";
import PageShell from "@/app/components/PageShell";
import ToolbarMenu from "@/app/components/ToolbarMenu";
import FilterPopover from "@/app/components/FilterPopover";
import { DOMINICAN_CITIES, DOMINICAN_PROVINCES } from "@/lib/locations";
import RequestDetailModal from "./RequestDetailModal";
import StaleBadge from "@/app/components/StaleBadge";

const PAGE_SIZE = 20;
const FILTERS = ["open", "completed", "unavailable", "ignored"];

function requestText(notes = "") {
  return notes.replace(/^WhatsApp request:\s*/, "");
}

function formatPrice(lead) {
  if (lead.min_price == null && lead.max_price == null) return null;
  const currency = lead.budget_currency || "";
  if (lead.min_price === lead.max_price) {
    return `${lead.min_price} ${currency}`.trim();
  }
  return `${lead.min_price ?? "0"}–${lead.max_price ?? "∞"} ${currency}`.trim();
}

function listingIntentBadge(lead, t) {
  if (lead.listing_type === "sale") return { label: t("selling"), color: "text-orange-700 bg-orange-100" };
  if (lead.listing_type === "rent") return { label: t("renting"), color: "text-blue-700 bg-blue-100" };
  const message = requestText(lead.notes || "");
  if (/\b(?:looking|need(?:ing)?|busco|buscamos|buscando|necesito|necesitamos|se busca|se necesita)\b/i.test(message)) {
    return { label: t("looking"), color: "text-amber-700 bg-amber-100" };
  }
  return { label: t("notSpecified"), color: "text-[var(--text-muted)] bg-[var(--surface-muted)]" };
}

function bedroomRange(item, t) {
  if (item.min == null && item.max == null) return t("notSpecified");
  if (item.min == null) return `≤ ${item.max} ${t("bedroomsShort")}`;
  if (item.max == null) return `${item.min}+ ${t("bedroomsShort")}`;
  if (item.min === item.max) return `${item.min} ${t("bedroomsShort")}`;
  return `${item.min}–${item.max} ${t("bedroomsShort")}`;
}

function inferEstateCity(lead) {
  const location = `${lead.city || ""} ${lead.preferred_location || ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return lead.city || DOMINICAN_CITIES.find((city) => {
    const cityKey = city.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return location.includes(cityKey);
  }) || "";
}

function inferEstateProvince(lead, city) {
  if (lead.province) return lead.province;
  const normalizedCity = city.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (["bavaro", "punta cana", "veron", "higuey"].includes(normalizedCity)) return "La Altagracia";
  if (normalizedCity === "bani") return "Peravia";
  if (normalizedCity === "santo domingo") return "Santo Domingo";
  return "";
}

export function InsightRows({ rows, emptyLabel }) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  if (!rows.length) {
    return <p className="py-4 text-sm text-[var(--text-muted)]">{emptyLabel}</p>;
  }
  return (
    <div className="space-y-2.5">
      {rows.map((row, index) => (
        <div key={row.id ?? `${String(row.label)}-${index}`}>
          <div className="mb-1 flex justify-between gap-3 text-xs">
            <span className="truncate">{row.label}</span>
            <span className="font-semibold tabular-nums">{row.value}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]">
            <div
              className="h-full rounded-full bg-[var(--green)]"
              style={{ width: `${Math.max(3, (row.value / max) * 100)}%` }}
            />
          </div>
          {row.subtitle && <p className="mt-1 text-xs text-[var(--text-muted)]">{row.subtitle}</p>}
        </div>
      ))}
    </div>
  );
}

export default function RequestQueuePage() {
  const { translate: t } = useTranslation();
  const [filter, setFilter] = useState("open");
  const [page, setPage] = useState(1);
  const [leads, setLeads] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [rescanning, setRescanning] = useState(false);
  const [brokerCandidates, setBrokerCandidates] = useState([]);
  const [brokerCandidatesOpen, setBrokerCandidatesOpen] = useState(false);
  const [selectedBrokerCandidateKeys, setSelectedBrokerCandidateKeys] = useState(new Set());
  const [savingBrokerCandidates, setSavingBrokerCandidates] = useState(false);
  const [view, setView] = useState("list");
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [savingCell, setSavingCell] = useState("");
  const [summary, setSummary] = useState(null);
  const [filters, setFilters] = useState({
    q: "",
    property_type: "",
    listing_type: "",
    bedrooms: "",
    location: "",
  });
  const [draftFilters, setDraftFilters] = useState(filters);
  const [exporting, setExporting] = useState(false);
  const [spreadsheetSort, setSpreadsheetSort] = useState({ field: "-created_at", label: "" });
  const [contactOpen, setContactOpen] = useState(false);
  const [contactType, setContactType] = useState("broker");
  const [contactDraft, setContactDraft] = useState({
    name: "",
    phone: "",
    email: "",
    company: "",
    identification: "",
    notes: "",
  });
  const [savingContact, setSavingContact] = useState(false);
  const [contactNotice, setContactNotice] = useState("");

  const [estateOpen, setEstateOpen] = useState(false);
  const [estateLead, setEstateLead] = useState(null);
  const [estateDraft, setEstateDraft] = useState(null);
  const [savingEstate, setSavingEstate] = useState(false);
  const [estateNotice, setEstateNotice] = useState("");

  const [selectedLeadIds, setSelectedLeadIds] = useState(new Set());
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState("");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [unconvertedOnly, setUnconvertedOnly] = useState(false);

  async function refreshBrokerCandidates() {
    const response = await fetchBrokerCandidates();
    setBrokerCandidates(response.results || []);
  }

  useEffect(() => {
    let active = true;
    fetchBrokerCandidates()
      .then((response) => {
        if (active) setBrokerCandidates(response.results || []);
      })
      .catch((candidateError) => {
        if (active) setError(candidateError.message || t("error"));
      });
    return () => {
      active = false;
    };
  }, [t]);

  function toggleBrokerCandidate(candidateKey) {
    setSelectedBrokerCandidateKeys((current) => {
      const next = new Set(current);
      if (next.has(candidateKey)) next.delete(candidateKey);
      else next.add(candidateKey);
      return next;
    });
  }

  async function saveSelectedBrokerCandidates(event) {
    event.preventDefault();
    const candidateKeys = Array.from(selectedBrokerCandidateKeys);
    if (!candidateKeys.length) return;
    setSavingBrokerCandidates(true);
    setError("");
    try {
      const result = await saveBrokerCandidates(candidateKeys);
      setNotice(t("brokerCandidatesSaved", result));
      setBrokerCandidatesOpen(false);
      setSelectedBrokerCandidateKeys(new Set());
      await Promise.all([refreshBrokerCandidates(), loadRequests()]);
    } catch (saveError) {
      setError(saveError.message || t("error"));
      if (saveError.message?.includes("no longer available")) {
        await refreshBrokerCandidates();
      }
    } finally {
      setSavingBrokerCandidates(false);
    }
  }

  async function rescanBrokerLinks() {
    setRescanning(true);
    setError("");
    setNotice("");
    try {
      const result = await rescanLeadBrokerLinks();
      await Promise.all([
        loadRequests(),
        fetchLeadSummary(filters).then(setSummary),
        refreshBrokerCandidates(),
      ]);
      setNotice(t("brokerRescanResult", {
        linked: result.linked,
        scanned: result.scanned,
      }));
    } catch (rescanError) {
      setError(rescanError.message || t("error"));
    } finally {
      setRescanning(false);
    }
  }

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetchLeads({
        ...filters,
        status: filter,
        page,
        ordering: view === "spreadsheet" ? spreadsheetSort.field : undefined,
      });
      const fetched = response.results || [];
      const filteredLeads = unconvertedOnly
        ? fetched.filter((lead) => !lead.estate_id && !lead.estate_slug)
        : fetched;
      setLeads(filteredLeads);
      setCount(unconvertedOnly ? filteredLeads.length : response.count || 0);
    } catch (loadError) {
      setError(loadError.message || t("error"));
    } finally {
      setLoading(false);
    }
  }, [filter, page, filters, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    let active = true;
    fetchLeadSummary(filters)
      .then((data) => {
        if (active) setSummary(data);
      })
      .catch((summaryError) => {
        if (active) setError(summaryError.message || t("error"));
      });
    return () => {
      active = false;
    };
  }, [filters, t]);

  const changeFilter = (nextFilter) => {
    setFilter(nextFilter);
    setPage(1);
  };

  function applyFilters(event) {
    event.preventDefault();
    setFilters(draftFilters);
    setPage(1);
  }

  async function exportRequests(format) {
    setExporting(true);
    setError("");
    try {
      const blob = await downloadLeadExport(format, { ...filters, status: filter });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `soreal_requests.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError.message || t("error"));
    } finally {
      setExporting(false);
    }
  }

  async function setLeadStatus(lead, status) {
    setBusyId(lead.id);
    setError("");
    try {
      await updateLeadStatus(lead.id, status);
      if (leads.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        setLeads((current) => current.filter((item) => item.id !== lead.id));
        setCount((current) => Math.max(0, current - 1));
      }
    } catch (updateError) {
      setError(updateError.message || t("error"));
    } finally {
      setBusyId(null);
    }
  }

  async function setUserIgnored(lead, ignored) {
    setBusyId(lead.id);
    setError("");
    try {
      if (ignored) {
        await ignoreLeadUser(lead.id);
      } else {
        await unignoreLeadUser(lead.id);
      }
      await loadRequests();
    } catch (updateError) {
      setError(updateError.message || t("error"));
    } finally {
      setBusyId(null);
    }
  }

  async function saveSpreadsheetCell(lead, field, value) {
    const key = `${lead.id}:${field}`;
    if (String(lead[field] ?? "") === String(value ?? "")) return;
    setSavingCell(key);
    setError("");
    try {
      const updatedValue = ["min_bedrooms", "min_price", "max_price"].includes(field)
        ? (value === "" ? null : Number(value))
        : value;
      const updated = await updateLead(lead.id, {
        [field]: updatedValue,
      });
      const filterMatches =
        filter === "all" ||
        (filter === "open" && ["new", "contacted", "matched"].includes(updated.status)) ||
        (filter === "completed" && ["completed", "closed"].includes(updated.status)) ||
        updated.status === filter;
      if (field === "status" && !filterMatches) {
        setLeads((current) => current.filter((item) => item.id !== lead.id));
        setCount((current) => Math.max(0, current - 1));
        if (leads.length === 1 && page > 1) setPage((current) => current - 1);
      } else {
        setLeads((current) => current.map((item) => item.id === lead.id ? { ...item, ...updated } : item));
      }
    } catch (saveError) {
      setError(saveError.message || t("error"));
    } finally {
      setSavingCell("");
    }
  }

  async function saveContact(event) {
    event.preventDefault();
    setSavingContact(true);
    setError("");
    try {
      if (contactType === "owner") {
        await createOwner(contactDraft);
      } else {
        await createBroker(contactDraft);
      }
      setContactNotice(t("contactAdded"));
      setContactOpen(false);
      setContactDraft({
        name: "",
        phone: "",
        email: "",
        company: "",
        identification: "",
        notes: "",
      });
    } catch (saveError) {
      setError(saveError.message || t("error"));
    } finally {
      setSavingContact(false);
    }
  }

  async function prepareEstateDraft(lead) {
    const city = inferEstateCity(lead);
    setEstateLead(lead);
    setEstateDraft({
      title: `${lead.property_type || t("property")} in ${lead.preferred_location || lead.city || lead.name || t("unknownRequester")}`.trim(),
      description: (lead.notes || "").replace(/^WhatsApp request:\s*/, ""),
      property_type: lead.property_type || "apartment",
      listing_type: lead.listing_type === "rent" ? "rent" : "sale",
      price: lead.max_price ?? lead.min_price ?? "",
      currency: lead.budget_currency || "USD",
      bedrooms: lead.min_bedrooms ?? "",
      bathrooms: lead.min_bathrooms ?? "",
      address: lead.preferred_location || "",
      city,
      province: inferEstateProvince(lead, city),
      status: "draft",
      broker: lead.broker || "",
      owner: "",
    });
    setEstateOpen(true);
  }

  async function saveEstate(event) {
    event.preventDefault();
    if (!estateLead || !estateDraft) return;
    setSavingEstate(true);
    setError("");
    try {
      const payload = {
        ...estateDraft,
        broker: estateDraft.broker ? Number(estateDraft.broker) : null,
        owner: estateDraft.owner ? Number(estateDraft.owner) : null,
        price: estateDraft.price === "" ? null : Number(estateDraft.price),
        bedrooms: estateDraft.bedrooms === "" ? null : Number(estateDraft.bedrooms),
        bathrooms: estateDraft.bathrooms === "" ? null : Number(estateDraft.bathrooms),
      };
      const estate = await createEstateFromLead(estateLead.id, payload);
      setError("");
      setEstateOpen(false);
      setEstateNotice(
        <>{t("estateCreated")} <Link href={`/estates/${estate.slug}`} className="font-semibold underline">{estate.title} ({estate.custom_id})</Link></>,
      );
      if (filter === "open") {
        setLeads((current) => current.filter((lead) => lead.id !== estateLead.id));
        setCount((current) => Math.max(0, current - 1));
      } else {
        setLeads((current) => current.map((lead) =>
          lead.id === estateLead.id
            ? { ...lead, status: "completed", estate_id: estate.id, estate_slug: estate.slug }
            : lead
        ));
      }
    } catch (saveError) {
      setError(saveError.message || t("error"));
    } finally {
      setSavingEstate(false);
    }
  }

  const toggleSelect = (leadId) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedLeadIds.size === leads.length) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(leads.map((l) => l.id)));
    }
  };

  const isSelected = (leadId) => selectedLeadIds.has(leadId);

  const openBulkModal = (action) => {
    setBulkAction(action);
    setBulkModalOpen(true);
  };

  async function runBulkAction() {
    const ids = Array.from(selectedLeadIds);
    if (ids.length === 0) return;
    setBulkSubmitting(true);
    setError("");
    try {
      if (bulkAction === "createEstates") {
        for (const id of ids) {
          const lead = leads.find((l) => l.id === id);
          if (!lead || lead.estate_slug) continue;
          const draft = {
            title: `${lead.property_type || t("property")} in ${lead.preferred_location || lead.city || lead.name || t("unknownRequester")}`.trim(),
            description: (lead.notes || "").replace(/^WhatsApp request:\s*/, ""),
            property_type: lead.property_type || "apartment",
            listing_type: lead.listing_type === "rent" ? "rent" : "sale",
            price: lead.max_price ?? lead.min_price ?? "",
            currency: lead.budget_currency || "USD",
            bedrooms: lead.min_bedrooms ?? "",
            bathrooms: lead.min_bathrooms ?? "",
            address: lead.preferred_location || "",
            city: lead.city || "",
            province: lead.province || "",
            latitude: lead.latitude || "",
            longitude: lead.longitude || "",
            status: "draft",
            broker: lead.broker || "",
            owner: "",
          };
          await saveEstateBulk(lead, draft);
        }
        setBulkModalOpen(false);
        setSelectedLeadIds(new Set());
        setNotice(t("estatesCreated", { count: ids.length }));
      } else if (bulkAction === "markCompleted") {
        await Promise.all(ids.map((id) => updateLeadStatus(id, "completed")));
        setSelectedLeadIds(new Set());
        setNotice(t("statusesUpdated", { count: ids.length }));
      } else if (bulkAction === "markIgnored") {
        await Promise.all(ids.map((id) => ignoreLeadUser(id)));
        setSelectedLeadIds(new Set());
        setNotice(t("statusesUpdated", { count: ids.length }));
      } else if (bulkAction === "markUnavailable") {
        await Promise.all(ids.map((id) => updateLeadStatus(id, "unavailable")));
        setSelectedLeadIds(new Set());
        setNotice(t("statusesUpdated", { count: ids.length }));
      } else if (bulkAction === "reopen") {
        await Promise.all(ids.map((id) => updateLeadStatus(id, "new")));
        setSelectedLeadIds(new Set());
        setNotice(t("statusesUpdated", { count: ids.length }));
      }
      await loadRequests();
    } catch (bulkError) {
      setError(bulkError.message || t("error"));
    } finally {
      setBulkSubmitting(false);
      setBulkModalOpen(false);
    }
  }

  async function saveEstateBulk(lead, draft) {
    if (!lead || !draft) return;
    const payload = {
      ...draft,
      broker: draft.broker ? Number(draft.broker) : null,
      owner: draft.owner ? Number(draft.owner) : null,
      price: draft.price === "" ? null : Number(draft.price),
      bedrooms: draft.bedrooms === "" ? null : Number(draft.bedrooms),
      bathrooms: draft.bathrooms === "" ? null : Number(draft.bathrooms),
    };
    const estate = await createEstateFromLead(lead.id, payload);
    setLeads((current) =>
      current.map((l) =>
        l.id === lead.id ? { ...l, estate_id: estate.id, estate_slug: estate.slug } : l
      )
    );
  }

  const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const pagination = pageCount > 1 ? (
    <div className="flex w-full items-center justify-between gap-3">
      <button
        type="button"
        disabled={page <= 1 || loading}
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
        disabled={page >= pageCount || loading}
        onClick={() => setPage((current) => current + 1)}
        className="toolbar-button disabled:opacity-40"
      >
        {t("next")}
      </button>
    </div>
  ) : null;

  const emptyFilters = {
    q: "",
    property_type: "",
    listing_type: "",
    bedrooms: "",
    location: "",
  };

  return (
    <>
      <PageShell
        className="request-page-shell"
        eyebrow={t("whatsappImport")}
        title={t("requestQueue")}
        description={t("requestQueueDescription")}
        actions={(
          <div className="request-page-actions">
            <Link href="/leads" className="toolbar-button toolbar-button-primary">
              {t("addLead")}
            </Link>
            <button
              type="button"
              onClick={rescanBrokerLinks}
              disabled={rescanning}
              className="toolbar-button"
              title={t("rescanBrokerLinks")}
            >
              <RefreshCw size={15} className={rescanning ? "animate-spin" : ""} />
              {t("rescanBrokerLinks")}
            </button>
            <button
              type="button"
              onClick={() => {
                setContactNotice("");
                setContactOpen(true);
              }}
              className="toolbar-button"
              title={t("addContact")}
              aria-label={t("addContact")}
            >
              <UserPlus size={15} />
              <span className="sr-only">{t("addContact")}</span>
            </button>
            <Link href="/whatsapp-import" className="toolbar-button">
              {t("importWhatsAppChat")}
            </Link>
            <ToolbarMenu label={t("requestTools")} className="request-actions-overflow">
              <Link href="/leads" className="toolbar-menu-item">{t("addLead")}</Link>
              <button
                type="button"
                onClick={() => {
                  setContactNotice("");
                  setContactOpen(true);
                }}
                className="toolbar-menu-item"
              >
                <UserPlus size={15} />
                <span>{t("addContact")}</span>
              </button>
              <button
                type="button"
                onClick={rescanBrokerLinks}
                disabled={rescanning}
                className="toolbar-menu-item"
              >
                <RefreshCw size={15} className={rescanning ? "animate-spin" : ""} />
                <span>{t("rescanBrokerLinks")}</span>
              </button>
              <Link href="/whatsapp-import" className="toolbar-menu-item">{t("importWhatsAppChat")}</Link>
            </ToolbarMenu>
          </div>
        )}
        toolbar={(
          <div className="request-toolbar">
            <div className="toolbar-tabs" role="tablist" aria-label={t("requestQueue")}>
              {FILTERS.map((status) => (
                <button
                  key={status}
                  type="button"
                  role="tab"
                  aria-selected={filter === status}
                  onClick={() => changeFilter(status)}
                  className={`toolbar-tab ${filter === status ? "toolbar-tab-active" : ""}`}
                >
                  {t(`requestFilter_${status}`)}
                </button>
              ))}
            </div>

            <form onSubmit={applyFilters} className="toolbar-search">
              <Search size={15} />
              <input
                value={draftFilters.q}
                onChange={(event) => setDraftFilters({ ...draftFilters, q: event.target.value })}
                placeholder={t("searchRequests")}
                aria-label={t("searchRequests")}
              />
            </form>

            <div className="toolbar-segmented" aria-label={t("requestQueue")}>
              {[
                ["list", List, t("requestsListView")],
                ["grid", LayoutGrid, t("requestsGridView")],
                ["spreadsheet", FileSpreadsheet, t("requestsSpreadsheetView")],
              ].map(([item, Icon, label]) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setView(item)}
                  title={label}
                  aria-label={label}
                  aria-pressed={view === item}
                  className={`toolbar-tab ${view === item ? "toolbar-tab-active" : ""}`}
                >
                  <Icon size={15} />
                </button>
              ))}
            </div>

            <FilterPopover
              label={t("filters")}
              count={activeFilterCount}
              closeLabel={t("close")}
            >
              <form
                onSubmit={(event) => {
                  applyFilters(event);
                  event.currentTarget.closest("details")?.removeAttribute("open");
                }}
                className="grid gap-2"
              >
                <div className="filter-popover-grid">
                  <label className="filter-field">
                    <span>{t("propertyType")}</span>
                    <select
                      value={draftFilters.property_type}
                      onChange={(event) => setDraftFilters({ ...draftFilters, property_type: event.target.value })}
                    >
                      <option value="">{t("allPropertyTypes")}</option>
                      {["apartment", "house", "villa", "land", "commercial"].map((type) => (
                        <option key={type} value={type}>{t(type)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="filter-field">
                    <span>{t("listingType")}</span>
                    <select
                      value={draftFilters.listing_type}
                      onChange={(event) => setDraftFilters({ ...draftFilters, listing_type: event.target.value })}
                    >
                      <option value="">{t("allListingTypes")}</option>
                      <option value="rent">{t("listing_rent")}</option>
                      <option value="sale">{t("listing_sale")}</option>
                    </select>
                  </label>
                  <label className="filter-field">
                    <span>{t("bedrooms")}</span>
                    <select
                      value={draftFilters.bedrooms}
                      onChange={(event) => setDraftFilters({ ...draftFilters, bedrooms: event.target.value })}
                    >
                      <option value="">{t("anyBedrooms")}</option>
                      {[1, 2, 3, 4, 5].map((number) => (
                        <option key={number} value={number}>{number} {t("bedroomsShort")}</option>
                      ))}
                    </select>
                  </label>
                  <label className="filter-field">
                    <span>{t("location")}</span>
                    <input
                      value={draftFilters.location}
                      onChange={(event) => setDraftFilters({ ...draftFilters, location: event.target.value })}
                      placeholder={t("location")}
                    />
                  </label>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="toolbar-button"
                    onClick={(event) => {
                      setDraftFilters(emptyFilters);
                      setFilters(emptyFilters);
                      setPage(1);
                      event.currentTarget.closest("details")?.removeAttribute("open");
                    }}
                  >
                    {t("clearFilters")}
                  </button>
                  <button type="submit" className="toolbar-button toolbar-button-primary">
                    <Search size={15} />
                    {t("applyFilters")}
                  </button>
                </div>
              </form>
            </FilterPopover>

            <span className="page-toolbar-spacer" />
            <span className="page-toolbar-label">{count} {t("requests")}</span>
            <ToolbarMenu label={t("moreActions")}>
              <button
                type="button"
                onClick={() => setUnconvertedOnly((prev) => !prev)}
                className="toolbar-menu-item"
                aria-pressed={unconvertedOnly}
              >
                <RotateCcw size={15} />
                <span>{unconvertedOnly ? t("showAllRequests") : t("unconvertedOnly")}</span>
              </button>
              {selectedLeadIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setBulkModalOpen(true)}
                  className="toolbar-menu-item"
                >
                  <AlertTriangle size={15} />
                  <span>{t("bulkActions")} ({selectedLeadIds.size})</span>
                </button>
              )}
              <button
                type="button"
                disabled={exporting}
                onClick={() => exportRequests("csv")}
                className="toolbar-menu-item"
                title={t("exportCSV")}
                aria-label={t("exportCSV")}
              >
                <Download size={15} />
                <span>CSV</span>
              </button>
              <button
                type="button"
                disabled={exporting}
                onClick={() => exportRequests("xlsx")}
                className="toolbar-menu-item"
                title={t("exportXlsx")}
                aria-label={t("exportXlsx")}
              >
                <FileSpreadsheet size={15} />
                <span>XLSX</span>
              </button>
            </ToolbarMenu>
          </div>
        )}
        footer={pagination}
      >
        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700">
            {error}
          </div>
        )}

        {notice && (
          <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-sm text-emerald-700">
            {notice}
          </div>
        )}

        {brokerCandidates.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--green)]/30 bg-[var(--surface)] p-3">
            <p className="text-sm font-medium text-[var(--foreground)]">
              {t("newBrokerCandidatesPrompt", { count: brokerCandidates.length })}
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedBrokerCandidateKeys(new Set(brokerCandidates.map((candidate) => candidate.candidate_key)));
                setBrokerCandidatesOpen(true);
              }}
              className="toolbar-button toolbar-button-primary"
            >
              {t("reviewBrokerCandidates")}
            </button>
          </div>
        )}

        {contactNotice && (
          <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-sm text-emerald-700">
            {contactNotice}
          </div>
        )}

        {estateNotice && (
          <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-sm text-emerald-700">
            {estateNotice}
          </div>
        )}

      {brokerCandidatesOpen && (
        <div className="fixed inset-0 z-[110] flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <form
            onSubmit={saveSelectedBrokerCandidates}
            className="my-4 grid w-full max-w-xl gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{t("brokerCandidatesTitle")}</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">{t("brokerCandidatesDescription")}</p>
              </div>
              <button type="button" onClick={() => setBrokerCandidatesOpen(false)} className="toolbar-button">
                <X size={16} />
                {t("close")}
              </button>
            </div>
            <div className="max-h-[55vh] space-y-2 overflow-y-auto">
              {brokerCandidates.map((candidate) => (
                <label
                  key={candidate.candidate_key}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--border)] p-3"
                >
                  <input
                    type="checkbox"
                    checked={selectedBrokerCandidateKeys.has(candidate.candidate_key)}
                    onChange={() => toggleBrokerCandidate(candidate.candidate_key)}
                    className="mt-1"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{candidate.name}</span>
                    {candidate.phone && <span className="block text-sm text-[var(--text-muted)]">{candidate.phone}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-[var(--text-muted)]">
                    {t("brokerCandidateRequests", { count: candidate.request_count })}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setBrokerCandidatesOpen(false)} className="toolbar-button">
                {t("cancel")}
              </button>
              <button
                type="submit"
                disabled={savingBrokerCandidates || selectedBrokerCandidateKeys.size === 0}
                className="toolbar-button toolbar-button-primary"
              >
                {savingBrokerCandidates ? t("saving") : `${t("saveSelectedBrokers")} (${selectedBrokerCandidateKeys.size})`}
              </button>
            </div>
          </form>
        </div>
      )}

      {contactOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <form
            onSubmit={saveContact}
            className="my-4 grid w-full max-w-2xl gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl sm:grid-cols-2"
          >
            <div className="flex items-center justify-between gap-3 sm:col-span-2">
              <h2 className="text-lg font-semibold">{t("newContact")}</h2>
              <button type="button" onClick={() => setContactOpen(false)} className="toolbar-button">
                <X size={16} />
                {t("close")}
              </button>
            </div>

            <div className="sm:col-span-2">
              <span className="mb-1.5 block text-sm font-medium">{t("contactType")}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setContactType("broker")}
                  className={`toolbar-button ${contactType === "broker" ? "toolbar-button-primary" : ""}`}
                >
                  {t("broker")}
                </button>
                <button
                  type="button"
                  onClick={() => setContactType("owner")}
                  className={`toolbar-button ${contactType === "owner" ? "toolbar-button-primary" : ""}`}
                >
                  {t("owner")}
                </button>
              </div>
            </div>

            {[
              ["name", contactType === "owner" ? t("ownerName") : t("brokerName"), true],
              ["phone", t("phone"), false],
              ["email", t("email"), false],
              ["company", t("company"), false],
              ...(contactType === "owner" ? [["identification", t("identification"), false]] : []),
            ].map(([field, label, required]) => (
              <label key={field} className="filter-field">
                <span>{label}</span>
                <input
                  required={required}
                  type={field === "email" ? "email" : "text"}
                  value={contactDraft[field] || ""}
                  onChange={(event) => setContactDraft({ ...contactDraft, [field]: event.target.value })}
                />
              </label>
            ))}

            <label className="filter-field sm:col-span-2">
              <span>{t("notes")}</span>
              <textarea
                rows={3}
                value={contactDraft.notes || ""}
                onChange={(event) => setContactDraft({ ...contactDraft, notes: event.target.value })}
              />
            </label>

            <div className="flex justify-end gap-2 sm:col-span-2">
              <button type="button" onClick={() => setContactOpen(false)} className="toolbar-button">
                {t("cancel")}
              </button>
              <button
                type="submit"
                disabled={savingContact}
                className="toolbar-button toolbar-button-primary disabled:opacity-50"
              >
                {savingContact ? t("saving") : t("saveContact")}
              </button>
            </div>
          </form>
        </div>
      )}

      {estateOpen && estateDraft && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <form
            onSubmit={saveEstate}
            className="my-4 grid w-full max-w-3xl gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl md:grid-cols-2"
          >
            <div className="flex items-center justify-between gap-3 md:col-span-2">
              <div>
                <h2 className="text-lg font-semibold">{t("estateFromRequest")}</h2>
                <p className="text-xs text-[var(--text-muted)]">{t("estateFromRequestDescription")}</p>
              </div>
              <button type="button" onClick={() => setEstateOpen(false)} className="toolbar-button">
                <X size={16} />
                {t("close")}
              </button>
            </div>

            <label className="filter-field md:col-span-2">
              <span>{t("estateTitle")}</span>
              <input
                required
                value={estateDraft.title}
                onChange={(event) => setEstateDraft({ ...estateDraft, title: event.target.value })}
              />
            </label>

            <label className="filter-field">
              <span>{t("propertyType")}</span>
              <select
                value={estateDraft.property_type}
                onChange={(event) => setEstateDraft({ ...estateDraft, property_type: event.target.value })}
              >
                {["apartment", "house", "villa", "land", "commercial"].map((option) => (
                  <option key={option} value={option}>{t(option)}</option>
                ))}
              </select>
            </label>

            <label className="filter-field">
              <span>{t("listingType")}</span>
              <select
                value={estateDraft.listing_type}
                onChange={(event) => setEstateDraft({ ...estateDraft, listing_type: event.target.value })}
              >
                {["sale", "rent"].map((option) => (
                  <option key={option} value={option}>{t(`listing_${option}`)}</option>
                ))}
              </select>
            </label>

            <label className="filter-field">
              <span>{t("price")}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={estateDraft.price}
                onChange={(event) => setEstateDraft({ ...estateDraft, price: event.target.value })}
              />
            </label>

            <label className="filter-field">
              <span>{t("currency")}</span>
              <input
                value={estateDraft.currency}
                onChange={(event) => setEstateDraft({ ...estateDraft, currency: event.target.value })}
              />
            </label>

            <label className="filter-field">
              <span>{t("bedrooms")}</span>
              <input
                type="number"
                min="0"
                value={estateDraft.bedrooms}
                onChange={(event) => setEstateDraft({ ...estateDraft, bedrooms: event.target.value })}
              />
            </label>

            <label className="filter-field">
              <span>{t("bathrooms")}</span>
              <input
                type="number"
                min="0"
                value={estateDraft.bathrooms}
                onChange={(event) => setEstateDraft({ ...estateDraft, bathrooms: event.target.value })}
              />
            </label>

            <label className="filter-field">
              <span>{t("city")}</span>
              <select
                value={estateDraft.city}
                onChange={(event) => setEstateDraft({ ...estateDraft, city: event.target.value })}
              >
                <option value="">—</option>
                {estateDraft.city && !DOMINICAN_CITIES.includes(estateDraft.city) && (
                  <option value={estateDraft.city}>{estateDraft.city}</option>
                )}
                {DOMINICAN_CITIES.map((city) => <option key={city} value={city}>{city}</option>)}
              </select>
            </label>

            <label className="filter-field">
              <span>{t("province")}</span>
              <select
                value={estateDraft.province}
                onChange={(event) => setEstateDraft({ ...estateDraft, province: event.target.value })}
              >
                <option value="">—</option>
                {estateDraft.province && !DOMINICAN_PROVINCES.includes(estateDraft.province) && (
                  <option value={estateDraft.province}>{estateDraft.province}</option>
                )}
                {DOMINICAN_PROVINCES.map((province) => <option key={province} value={province}>{province}</option>)}
              </select>
            </label>

            <label className="filter-field">
              <span>{t("latitude")}</span>
              <input
                type="number"
                step="any"
                value={estateDraft.latitude || ""}
                onChange={(event) => setEstateDraft({ ...estateDraft, latitude: event.target.value })}
              />
            </label>

            <label className="filter-field">
              <span>{t("longitude")}</span>
              <input
                type="number"
                step="any"
                value={estateDraft.longitude || ""}
                onChange={(event) => setEstateDraft({ ...estateDraft, longitude: event.target.value })}
              />
            </label>

            <label className="filter-field md:col-span-2">
              <span>{t("address")}</span>
              <input
                value={estateDraft.address}
                onChange={(event) => setEstateDraft({ ...estateDraft, address: event.target.value })}
              />
            </label>

            <label className="filter-field md:col-span-2">
              <span>{t("description")}</span>
              <textarea
                rows={3}
                value={estateDraft.description}
                onChange={(event) => setEstateDraft({ ...estateDraft, description: event.target.value })}
              />
            </label>

            <div className="flex justify-end gap-2 md:col-span-2">
              <button type="button" onClick={() => setEstateOpen(false)} className="toolbar-button">
                {t("cancel")}
              </button>
              <button
                type="submit"
                disabled={savingEstate || !estateDraft.title}
                className="toolbar-button toolbar-button-primary disabled:opacity-50"
              >
                {savingEstate ? t("saving") : t("createEstateAsDraft")}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--text-muted)]">
          {t("loading")}
        </div>
      ) : leads.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-10 text-center">
          <Check className="mx-auto mb-3 text-[var(--green)]" size={28} />
          <h2 className="font-semibold">{t("noRequestsInFilter")}</h2>
        </div>
      ) : view === "spreadsheet" ? (
        <div className="table-scroll">
          <table className="w-full min-w-[1550px] border-collapse text-left text-sm">
            <thead className="bg-[var(--surface-muted)] text-xs uppercase text-[var(--text-muted)]">
              <tr>
                <th className="px-3 py-3" style={{ width: 40 }}>
                  <input
                    type="checkbox"
                    checked={selectedLeadIds.size === leads.length && leads.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                {[
                  { label: t("requester"), field: "name", api: "name" },
                  { label: t("phone"), field: "phone", api: "phone" },
                  { label: t("propertyType"), field: "property_type", api: "property_type" },
                  { label: t("listingType"), field: "listing_type", api: "listing_type" },
                  { label: t("bedrooms"), field: "bedrooms", api: "min_bedrooms" },
                  { label: t("minPrice"), field: "min_price", api: "min_price" },
                  { label: t("maxPrice"), field: "max_price", api: "max_price" },
                  { label: t("province"), field: "province", api: "province" },
                  { label: t("city"), field: "city", api: "city" },
                  { label: t("location"), field: "preferred_location", api: "preferred_location" },
                  { label: t("status"), field: "status", api: "status" },
                ].map((column) => {
                  const active = spreadsheetSort.field.replace(/^-/, "") === column.api;
                  return (
                    <th
                      key={column.api}
                      className="px-3 py-3 cursor-pointer select-none group"
                      onClick={() => {
                        const next = active && spreadsheetSort.field.startsWith("-") ? column.api : `-${column.api}`;
                        setSpreadsheetSort({ field: next, label: column.label });
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        {column.label}
                        {active && (
                          <span className="text-[var(--text-muted)]">
                            {spreadsheetSort.field.startsWith("-") ? "↓" : "↑"}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2" style={{ width: 40 }}>
                    <input
                      type="checkbox"
                      checked={isSelected(lead.id)}
                      onChange={() => toggleSelect(lead.id)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => setSelectedLeadId(lead.id)} className="max-w-40 truncate font-semibold text-[var(--green)] hover:underline">
                        {lead.name || t("unknownRequester")}
                      </button>
                      <StaleBadge createdAt={lead.created_at} />
                    </div>
                    <input aria-label={t("requester")} defaultValue={lead.name || ""} onBlur={(event) => saveSpreadsheetCell(lead, "name", event.target.value)} className="mt-1 w-40 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1" />
                  </td>
                  <td className="px-3 py-2"><input aria-label={t("phone")} defaultValue={lead.phone || ""} onBlur={(event) => saveSpreadsheetCell(lead, "phone", event.target.value)} className="w-36 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1" /></td>
                  <td className="px-3 py-2">
                    <select aria-label={t("propertyType")} value={lead.property_type || ""} onChange={(event) => saveSpreadsheetCell(lead, "property_type", event.target.value || null)} className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1">
                      <option value="">—</option>
                      {["apartment", "house", "villa", "land", "commercial"].map((type) => <option key={type} value={type}>{t(type)}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select aria-label={t("listingType")} value={lead.listing_type || "any"} onChange={(event) => saveSpreadsheetCell(lead, "listing_type", event.target.value)} className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1">
                      {["any", "rent", "sale"].map((type) => <option key={type} value={type}>{type === "any" ? t("anyListingType") : t(`listing_${type}`)}</option>)}
                    </select>
                    <span className={`mt-0.5 block inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${listingIntentBadge(lead, t).color}`}>
                      {listingIntentBadge(lead, t).label}
                    </span>
                  </td>
                  <td className="px-3 py-2"><input aria-label={t("bedrooms")} type="number" min="0" defaultValue={lead.min_bedrooms ?? ""} onBlur={(event) => saveSpreadsheetCell(lead, "min_bedrooms", event.target.value)} className="w-20 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1" /></td>
                  <td className="px-3 py-2"><input aria-label={t("minPrice")} type="number" min="0" step="0.01" defaultValue={lead.min_price ?? ""} onBlur={(event) => saveSpreadsheetCell(lead, "min_price", event.target.value)} className="w-28 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1" /></td>
                  <td className="px-3 py-2"><input aria-label={t("maxPrice")} type="number" min="0" step="0.01" defaultValue={lead.max_price ?? ""} onBlur={(event) => saveSpreadsheetCell(lead, "max_price", event.target.value)} className="w-28 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1" /></td>
                  <td className="px-3 py-2">
                    <select aria-label={t("province")} value={lead.province || ""} onChange={(event) => saveSpreadsheetCell(lead, "province", event.target.value)} className="max-w-40 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1">
                      <option value="">—</option>
                      {lead.province && !DOMINICAN_PROVINCES.includes(lead.province) && <option value={lead.province}>{lead.province}</option>}
                      {DOMINICAN_PROVINCES.map((province) => <option key={province} value={province}>{province}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select aria-label={t("city")} value={lead.city || ""} onChange={(event) => saveSpreadsheetCell(lead, "city", event.target.value)} className="max-w-40 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1">
                      <option value="">—</option>
                      {lead.city && !DOMINICAN_CITIES.includes(lead.city) && <option value={lead.city}>{lead.city}</option>}
                      {DOMINICAN_CITIES.map((city) => <option key={city} value={city}>{city}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input aria-label={t("location")} defaultValue={lead.preferred_location || ""} onBlur={(event) => saveSpreadsheetCell(lead, "preferred_location", event.target.value)} className="w-40 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1" />
                  </td>
                  <td className="px-3 py-2">
                    {lead.status === "ignored" ? (
                      <span className="text-[var(--text-muted)]">{t("leadStatus_ignored")}</span>
                    ) : (
                      <select aria-label={t("status")} value={lead.status} onChange={(event) => saveSpreadsheetCell(lead, "status", event.target.value)} className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1">
                        {["new", "contacted", "matched", "completed", "unavailable", "closed"].map((status) => <option key={status} value={status}>{t(`leadStatus_${status}`)}</option>)}
                      </select>
                    )}
                    {savingCell.startsWith(`${lead.id}:`) && <span className="ml-2 text-xs text-[var(--text-muted)]">{t("saving")}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-[var(--border)] px-3 py-2 text-xs text-[var(--text-muted)]">{t("spreadsheetAutosaveHint")}</p>
        </div>
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {leads.map((lead) => (
            <article key={lead.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm relative">
              <input
                type="checkbox"
                className="absolute top-2 right-2"
                checked={isSelected(lead.id)}
                onChange={() => toggleSelect(lead.id)}
              />
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setSelectedLeadId(lead.id)} className="text-left text-lg font-semibold text-[var(--green)] hover:underline">
                  {lead.name || t("unknownRequester")}
                </button>
                <StaleBadge createdAt={lead.created_at} />
              </div>
              <p className="mt-1 text-sm text-[var(--text-muted)]">{lead.phone || t("phoneNotFound")}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className={`rounded-md px-2 py-1 ${listingIntentBadge(lead, t).color}`}>
                  {listingIntentBadge(lead, t).label}
                </span>
                {[lead.property_type && t(lead.property_type), lead.listing_type && lead.listing_type !== "any" && t(`listing_${lead.listing_type}`), lead.min_bedrooms != null && `${lead.min_bedrooms}+ ${t("bedroomsShort")}`, lead.city || lead.preferred_location, lead.province, formatPrice(lead)]
                  .filter(Boolean).map((value) => <span key={value} className="rounded-md bg-[var(--surface-muted)] px-2 py-1">{value}</span>)}
              </div>
              <p className="mt-4 line-clamp-4 whitespace-pre-wrap text-sm text-[var(--text-muted)]">{requestText(lead.notes || "")}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {leads.map((lead) => {
            const price = formatPrice(lead);
            const isOpen = filter === "open";
            return (
              <article
                key={lead.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm relative"
              >
                <input
                  type="checkbox"
                  className="absolute top-2 right-2"
                  checked={isSelected(lead.id)}
                  onChange={() => toggleSelect(lead.id)}
                />
                <div className="request-card-header flex flex-wrap items-start justify-between gap-4">
                  <div className="request-card-main min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/requests/${lead.id}`}
                        onClick={(event) => {
                          event.preventDefault();
                          setSelectedLeadId(lead.id);
                        }}
                        className="text-lg font-semibold text-[var(--foreground)] hover:text-[var(--green)] hover:underline"
                      >
                        {lead.name || t("unknownRequester")}
                      </Link>
                      <StaleBadge createdAt={lead.created_at} />
                      <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-medium text-[var(--text-muted)]">
                        {t(`leadStatus_${lead.status}`)}
                      </span>
                    </div>
                    {lead.phone ? (
                      <a
                        href={`tel:${lead.phone}`}
                        className="mt-1 inline-block text-sm font-medium text-[var(--green)] hover:underline"
                      >
                        {lead.phone}
                      </a>
                    ) : (
                      <p className="mt-1 text-sm text-[var(--text-muted)]">{t("phoneNotFound")}</p>
                    )}
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {lead.whatsapp_group || "WhatsApp"} · {new Date(lead.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className={`rounded-md px-2 py-1 ${listingIntentBadge(lead, t).color}`}>
                    {listingIntentBadge(lead, t).label}
                  </span>
                  {[
                    lead.listing_type !== "any" && t(`listing_${lead.listing_type}`),
                    lead.property_type,
                    lead.min_bedrooms != null &&
                      `${lead.min_bedrooms}${lead.max_bedrooms !== lead.min_bedrooms ? `–${lead.max_bedrooms}` : ""} ${t("bedroomsShort")}`,
                    lead.min_bathrooms != null &&
                      `${lead.min_bathrooms}${lead.max_bathrooms !== lead.min_bathrooms ? `–${lead.max_bathrooms}` : ""} ${t("bathroomsShort")}`,
                    price,
                    lead.preferred_location,
                    lead.furnishing && t(`furnishing_${lead.furnishing}`),
                  ]
                    .filter(Boolean)
                    .map((detail) => (
                      <span
                        key={detail}
                        className="rounded-md bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)]"
                      >
                        {detail}
                      </span>
                    ))}
                  {!lead.property_type &&
                    lead.min_bedrooms == null &&
                    lead.min_price == null &&
                    !lead.preferred_location && (
                      <span className="text-sm text-amber-700">{t("needsReview")}</span>
                    )}
                </div>

                <div className="request-card-footer">
                  {lead.notes && (
                    <details className="request-original-request">
                      <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[var(--green)]">
                        <Clock3 size={15} />
                        {t("originalRequest")}
                      </summary>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--text-muted)]">
                        {requestText(lead.notes)}
                      </p>
                    </details>
                  )}
                  <div className="request-card-actions flex flex-wrap gap-2">
                    {filter === "ignored" ? (
                      <button
                        type="button"
                        disabled={busyId === lead.id}
                        onClick={() => setUserIgnored(lead, false)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] hover:border-[var(--green)] disabled:opacity-50"
                      >
                        <RotateCcw size={15} />
                        {t("unignoreUser")}
                      </button>
                    ) : isOpen ? (
                      <button
                        type="button"
                        aria-label={t("markCompleted")}
                        title={t("markCompleted")}
                        disabled={busyId === lead.id}
                        onClick={() => setLeadStatus(lead, "completed")}
                        className="request-complete-button inline-flex items-center justify-center rounded-lg bg-[var(--green)] text-white hover:opacity-90 disabled:opacity-50"
                      >
                        <Check size={16} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busyId === lead.id}
                        onClick={() => setLeadStatus(lead, "new")}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] hover:border-[var(--green)] disabled:opacity-50"
                      >
                        <RotateCcw size={15} />
                        {t("reopenRequest")}
                      </button>
                    )}
                    <ToolbarMenu label={t("moreActions")}>
                      {isOpen && lead.source === "whatsapp" && (
                        <button
                          type="button"
                          disabled={busyId === lead.id}
                          onClick={() => setUserIgnored(lead, true)}
                          className="toolbar-menu-item"
                        >
                          <UserRoundX size={15} />
                          <span>{t("ignoreUser")}</span>
                        </button>
                      )}
                      {isOpen && (
                        <button
                          type="button"
                          disabled={busyId === lead.id}
                          onClick={() => setLeadStatus(lead, "unavailable")}
                          className="toolbar-menu-item"
                        >
                          <X size={15} />
                          <span>{t("markUnavailable")}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busyId === lead.id || !!lead.estate_slug}
                        onClick={() => prepareEstateDraft(lead)}
                        className="toolbar-menu-item"
                        title={lead.estate_slug ? t("estateAlreadyCreated") : t("estateFromRequest")}
                      >
                        <Save size={15} />
                        <span>{lead.estate_slug ? t("estateAlreadyCreated") : t("estateFromRequest")}</span>
                      </button>
                    </ToolbarMenu>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {bulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              runBulkAction();
            }}
            className="my-4 grid w-full max-w-md gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl"
          >
            <div className="flex items-center justify-between gap-3 sm:col-span-2">
              <h2 className="text-lg font-semibold">{t("bulkActions")}</h2>
              <button type="button" onClick={() => setBulkModalOpen(false)} className="toolbar-button">
                <X size={16} />
                {t("close")}
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/50">
                <span className="font-medium">{selectedLeadIds.size} {t("leadsSelected", { count: selectedLeadIds.size })}</span>
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-xs text-[var(--text-muted)] hover:underline"
                >
                  {selectedLeadIds.size === leads.length ? t("selectNone") : t("selectAll")}
                </button>
              </div>

              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={() => openBulkModal("createEstates")}
                  className="w-full text-left py-2 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-muted)] text-sm text-[var(--foreground)]"
                >
                  <Save size={14} className="mr-2" />
                  {t("bulkCreateEstates")}
                </button>
                <button
                  type="button"
                  onClick={() => openBulkModal("markCompleted")}
                  className="w-full text-left py-2 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-muted)] text-sm text-[var(--foreground)]"
                >
                  <Check size={14} className="mr-2" />
                  {t("bulkMarkCompleted")}
                </button>
                <button
                  type="button"
                  onClick={() => openBulkModal("markIgnored")}
                  className="w-full text-left py-2 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-muted)] text-sm text-[var(--foreground)]"
                >
                  <UserRoundX size={14} className="mr-2" />
                  {t("bulkMarkIgnored")}
                </button>
                <button
                  type="button"
                  onClick={() => openBulkModal("markUnavailable")}
                  className="w-full text-left py-2 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-muted)] text-sm text-[var(--foreground)]"
                >
                  <X size={14} className="mr-2" />
                  {t("bulkMarkUnavailable")}
                </button>
                <button
                  type="button"
                  onClick={() => openBulkModal("reopen")}
                  className="w-full text-left py-2 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-muted)] text-sm text-[var(--foreground)]"
                >
                  <RotateCcw size={14} className="mr-2" />
                  {t("bulkReopen")}
                </button>
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setBulkModalOpen(false)} className="toolbar-button">
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={bulkSubmitting}
                  className="toolbar-button toolbar-button-primary disabled:opacity-50"
                >
                  {bulkSubmitting ? t("saving") : t("bulkConfirm")}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      </PageShell>
      {selectedLeadId && (
        <RequestDetailModal
          leadId={selectedLeadId}
          onClose={() => setSelectedLeadId(null)}
          onSaved={(updated) => setLeads((current) => current.map((lead) => lead.id === updated.id ? { ...lead, ...updated } : lead))}
        />
      )}
    </>
  );
}
