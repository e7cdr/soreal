"use client";

import { useState, useEffect } from "react";
import { fetchEstates, createSavedSearch, fetchSavedSearches } from "@/lib/api";
import PropertyCard from "@/app/components/PropertyCard";
import EmptyState from "@/app/components/EmptyState";
import Pagination from "@/app/components/Pagination";
import dynamic from "next/dynamic";
import { useTranslation } from "@/app/components/LanguageProvider";
import PageShell from "@/app/components/PageShell";
import FilterPopover from "@/app/components/FilterPopover";
import ToolbarMenu from "@/app/components/ToolbarMenu";
import { Copy, Search } from "lucide-react";
import { buildEstatesCopyText } from "@/lib/estate-copy";
import { copyToClipboard } from "@/lib/clipboard";

const PropertyMap = dynamic(
  () => import("@/app/components/PropertyMap").then((mod) => mod.default),
  { ssr: false, loading: () => <div className="h-[220px] w-full animate-pulse rounded-lg bg-gray-200" /> }
);

export default function EstatesPage() {
  const { translate: t } = useTranslation();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [count, setCount] = useState(0);
  const [filters, setFilters] = useState({
    q: "",
    city: "",
    property_type: "",
    listing_type: "",
    min_price: "",
    max_price: "",
    bedrooms: "",
    source_site: "",
  });
  const [draftFilters, setDraftFilters] = useState(filters);
  const [savedSearches, setSavedSearches] = useState([]);
  const [searchName, setSearchName] = useState("");
  const [searchEmail, setSearchEmail] = useState("");
  const [savingSearch, setSavingSearch] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [copying, setCopying] = useState(false);
  const [copyStatus, setCopyStatus] = useState(null);

  useEffect(() => {
    if (!copyStatus) return undefined;
    const timer = window.setTimeout(() => setCopyStatus(null), 5000);
    return () => window.clearTimeout(timer);
  }, [copyStatus]);

  useEffect(() => {
    loadProperties();
  }, [page, filters]);

  useEffect(() => {
    loadSavedSearches();
  }, []);

  async function loadProperties() {
    setLoading(true);
    setSelectedIds([]);
    try {
      const data = await fetchEstates({ ...filters, page });
      setProperties(data.results || []);
      setCount(data.count || 0);
      setTotalPages(Math.ceil((data.count || 0) / 20));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadSavedSearches() {
    try {
      const data = await fetchSavedSearches();
      setSavedSearches(data.results || []);
    } catch (err) {
      // Saved searches require auth; ignore errors for public users
    }
  }

  const handleFilterChange = (name, value) => {
    setDraftFilters((prev) => ({ ...prev, [name]: value }));
  };

  function applyFilters(event) {
    if (event) event.preventDefault();
    setFilters(draftFilters);
    setPage(1);
  }

  const handleSaveSearch = async (e) => {
    e.preventDefault();
    const popover = e.currentTarget.closest("details");
    setSavingSearch(true);
    try {
      await createSavedSearch({
        name: searchName,
        email: searchEmail || null,
        filters,
      });
      popover?.removeAttribute("open");
      setSearchName("");
      setSearchEmail("");
      await loadSavedSearches();
    } catch (err) {
      alert(err.message || "Failed to save search.");
    } finally {
      setSavingSearch(false);
    }
  };

  const handleLoadSavedSearch = (search) => {
    const nextFilters = {
      q: search.filters.q || "",
      city: search.filters.city || "",
      property_type: search.filters.property_type || "",
      listing_type: search.filters.listing_type || "",
      min_price: search.filters.min_price || "",
      max_price: search.filters.max_price || "",
      bedrooms: search.filters.bedrooms || "",
    };
    setDraftFilters(nextFilters);
    setFilters(nextFilters);
    setPage(1);
  };

  function toggleSelected(id) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  function toggleSelectAll() {
    const pageIds = properties.map((property) => property.id);
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
    setSelectedIds((current) =>
      allSelected
        ? current.filter((id) => !pageIds.includes(id))
        : Array.from(new Set([...current, ...pageIds])),
    );
  }

  async function copySelected() {
    const selected = properties.filter((property) => selectedIds.includes(property.id));
    if (!selected.length) return;
    const copied = await copyToClipboard(buildEstatesCopyText(selected));
    setCopyStatus(
      copied
        ? t("bulkCopied", { count: selected.length })
        : t("copyFailed"),
    );
  }

  async function copyAllFiltered() {
    setCopying(true);
    setCopyStatus(null);
    try {
      const first = await fetchEstates({ ...filters, page: 1 });
      const all = [...(first.results || [])];
      const pageSize = first.results?.length || 20;
      const pages = Math.ceil((first.count || 0) / pageSize);
      for (let nextPage = 2; nextPage <= pages; nextPage += 1) {
        const data = await fetchEstates({ ...filters, page: nextPage });
        all.push(...(data.results || []));
      }
      const copied = await copyToClipboard(buildEstatesCopyText(all));
      setCopyStatus(
        copied ? t("bulkCopied", { count: all.length }) : t("copyFailed"),
      );
    } catch (copyError) {
      setCopyStatus(copyError.message || t("copyFailed"));
    } finally {
      setCopying(false);
    }
  }

  if (loading) {
    return (
      <PageShell title={t("estatesTitle")}>
        <div className="compact-card text-sm text-[var(--text-muted)]">{t("loading")}</div>
      </PageShell>
    );
  }
  if (error) {
    return (
      <PageShell title={t("estatesTitle")}>
        <div className="compact-card text-sm text-red-600">{error}</div>
      </PageShell>
    );
  }

  const activeFilters = Object.values(filters).filter(Boolean).length;
  const allPageSelected =
    properties.length > 0 &&
    properties.every((property) => selectedIds.includes(property.id));

  return (
    <PageShell
      title={t("estatesTitle")}
      toolbar={(
        <>
          <form onSubmit={applyFilters} className="toolbar-search">
            <Search size={15} />
            <input
              value={draftFilters.q}
              onChange={(event) => handleFilterChange("q", event.target.value)}
              placeholder={t("search")}
              aria-label={t("search")}
            />
          </form>

          <FilterPopover label={t("filters")} count={activeFilters} closeLabel={t("close")}>
            <form
              onSubmit={(event) => {
                applyFilters(event);
                event.currentTarget.closest("details")?.removeAttribute("open");
              }}
              className="grid gap-2"
            >
              <div className="filter-popover-grid">
                <label className="filter-field">
                  <span>{t("city")}</span>
                  <input
                    value={draftFilters.city}
                    onChange={(event) => handleFilterChange("city", event.target.value)}
                  />
                </label>
                <label className="filter-field">
                  <span>{t("propertyType")}</span>
                  <select
                    value={draftFilters.property_type}
                    onChange={(event) => handleFilterChange("property_type", event.target.value)}
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
                    onChange={(event) => handleFilterChange("listing_type", event.target.value)}
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
                    onChange={(event) => handleFilterChange("bedrooms", event.target.value)}
                  >
                    <option value="">{t("anyBedrooms")}</option>
                    {[1, 2, 3, 4, 5].map((number) => (
                      <option key={number} value={number}>{number} {t("bedroomsShort")}</option>
                    ))}
                  </select>
                </label>
                <label className="filter-field">
                  <span>{t("minPrice")}</span>
                  <input
                    type="number"
                    min="0"
                    value={draftFilters.min_price}
                    onChange={(event) => handleFilterChange("min_price", event.target.value)}
                  />
                </label>
                <label className="filter-field">
                  <span>{t("maxPrice")}</span>
                  <input
                    type="number"
                    min="0"
                    value={draftFilters.max_price}
                    onChange={(event) => handleFilterChange("max_price", event.target.value)}
                  />
                </label>
                <label className="filter-field">
                  <span>{t("sourceSite")}</span>
                  <input
                    value={draftFilters.source_site}
                    onChange={(event) => handleFilterChange("source_site", event.target.value)}
                    placeholder={t("sourceSitePlaceholder")}
                  />
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="toolbar-button"
                  onClick={(event) => {
                    const cleared = {
                      q: "",
                      city: "",
                      property_type: "",
                      listing_type: "",
                      min_price: "",
                      max_price: "",
                      bedrooms: "",
                      source_site: "",
                    };
                    setDraftFilters(cleared);
                    setFilters(cleared);
                    setPage(1);
                    event.currentTarget.closest("details")?.removeAttribute("open");
                  }}
                >
                  {t("clearFilters")}
                </button>
                <button type="submit" className="toolbar-button toolbar-button-primary">
                  {t("applyFilters")}
                </button>
              </div>
            </form>
          </FilterPopover>

          <FilterPopover label={t("saveSearch")} closeLabel={t("close")}>
            <form onSubmit={handleSaveSearch} className="grid gap-2">
              <label className="filter-field">
                <span>{t("searchName")}</span>
                <input
                  type="text"
                  name="name"
                  value={searchName}
                  onChange={(event) => setSearchName(event.target.value)}
                  required
                />
              </label>
              <label className="filter-field">
                <span>{t("email")}</span>
                <input
                  type="email"
                  name="email"
                  value={searchEmail}
                  onChange={(event) => setSearchEmail(event.target.value)}
                  placeholder="optional@example.com"
                />
              </label>
              <button
                type="submit"
                disabled={savingSearch}
                className="toolbar-button toolbar-button-primary disabled:opacity-50"
              >
                {savingSearch ? t("saving") : t("saveCurrentSearch")}
              </button>
            </form>
          </FilterPopover>

          {savedSearches.length > 0 && (
            <FilterPopover label={t("savedSearches")} closeLabel={t("close")}>
              <div className="grid gap-1">
                {savedSearches.map((search) => (
                  <button
                    key={search.id}
                    type="button"
                    className="toolbar-menu-item"
                    onClick={(event) => {
                      handleLoadSavedSearch(search);
                      event.currentTarget.closest("details")?.removeAttribute("open");
                    }}
                  >
                    {search.name}
                  </button>
                ))}
              </div>
            </FilterPopover>
          )}

          {properties.length > 0 && (
            <>
              <label className="toolbar-check">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={toggleSelectAll}
                />
                <span>{t("selectAll")}</span>
              </label>

              {selectedIds.length > 0 && (
                <button
                  type="button"
                  className="toolbar-button toolbar-button-primary"
                  onClick={copySelected}
                  disabled={copying}
                >
                  <Copy size={14} aria-hidden="true" />
                  {t("copySelected", { count: selectedIds.length })}
                </button>
              )}

              <ToolbarMenu label={t("bulkActions")}>
                <button
                  type="button"
                  className="toolbar-menu-item"
                  onClick={copyAllFiltered}
                  disabled={copying}
                >
                  <Copy size={14} aria-hidden="true" />
                  {copying ? t("loading") : t("copyAllFiltered", { count })}
                </button>
                {selectedIds.length > 0 && (
                  <button
                    type="button"
                    className="toolbar-menu-item"
                    onClick={() => setSelectedIds([])}
                  >
                    {t("clearSelection")}
                  </button>
                )}
              </ToolbarMenu>
            </>
          )}

          {copyStatus && <span className="estate-copy-status">{copyStatus}</span>}

          <span className="page-toolbar-spacer" />
          <span className="page-toolbar-label">{count} {t("propertiesFound")}</span>
        </>
      )}
      footer={totalPages > 1 ? (
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      ) : null}
    >
      {properties.length > 0 && (
        <div className="mb-3">
          <PropertyMap properties={properties} height={220} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {properties.length === 0 ? (
          <EmptyState
            title={t("noProperties")}
            message={t("tryAdjustingFilters")}
          />
        ) : (
          properties.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              selected={selectedIds.includes(property.id)}
              onToggleSelected={toggleSelected}
            />
          ))
        )}
      </div>
    </PageShell>
  );
}
