"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { fetchEstates, createSavedSearch, fetchSavedSearches } from "@/lib/api";
import PropertyCard from "@/app/components/PropertyCard";
import EmptyState from "@/app/components/EmptyState";
import Pagination from "@/app/components/Pagination";
import dynamic from "next/dynamic";
import { useTranslation } from "@/app/components/LanguageProvider";
import { Heart } from "lucide-react";
import {
  isFavorite,
  addFavorite,
  removeFavorite,
} from "@/lib/favorites";

const PropertyMap = dynamic(
  () => import("@/app/components/PropertyMap").then((mod) => mod.default),
  { ssr: false, loading: () => <div className="w-full h-[400px] bg-gray-200 rounded-lg animate-pulse" /> }
);

export default function EstatesPage() {
  const { t } = useTranslation();
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
  });
  const [savedSearches, setSavedSearches] = useState([]);
  const [showSaveSearch, setShowSaveSearch] = useState(false);
  const [searchName, setSearchName] = useState("");
  const [searchEmail, setSearchEmail] = useState("");
  const [savingSearch, setSavingSearch] = useState(false);

  useEffect(() => {
    loadProperties();
    loadSavedSearches();
  }, [page, filters]);

  async function loadProperties() {
    setLoading(true);
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
    setFilters((prev) => ({ ...prev, [name]: value }));
    setPage(1);
  };

  const handleSaveSearch = async (e) => {
    e.preventDefault();
    setSavingSearch(true);
    try {
      await createSavedSearch({
        name: searchName,
        email: searchEmail || null,
        filters,
      });
      setShowSaveSearch(false);
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
    setFilters({
      q: search.filters.q || "",
      city: search.filters.city || "",
      property_type: search.filters.property_type || "",
      listing_type: search.filters.listing_type || "",
      min_price: search.filters.min_price || "",
      max_price: search.filters.max_price || "",
      bedrooms: search.filters.bedrooms || "",
    });
  };

  if (loading) return <div className="p-6">{t("loading")}</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">{t("estatesTitle")}</h1>

      {properties.length > 0 && (
        <PropertyMap properties={properties} />
      )}

      <div className="flex justify-between items-start mb-6 flex-wrap gap-4">
        {savedSearches.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            <h3 className="text-sm font-medium text-gray-600">
              {t("savedSearches", {}, {})}:
            </h3>
            {savedSearches.map((s) => (
              <button
                key={s.id}
                onClick={() => handleLoadSavedSearch(s)}
                className="text-sm bg-blue-50 border border-blue-200 rounded px-3 py-1 hover:bg-blue-100 text-blue-700"
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => setShowSaveSearch(true)}
          className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
        >
          {t("saveSearch", {}, {})}
        </button>
      </div>

      {showSaveSearch && (
        <div className="mb-6 bg-gray-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium mb-3">
            {t("saveCurrentSearch", {}, {})}
          </h3>
          <form onSubmit={handleSaveSearch} className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">
                {t("searchName", {}, {})}
              </label>
              <input
                type="text"
                name="name"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                required
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                {t("email")}
              </label>
              <input
                type="email"
                name="email"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="optional@example.com"
              />
            </div>
            <button
              type="submit"
              disabled={savingSearch}
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:bg-blue-300"
            >
              {savingSearch ? t("saving", {}, {}) : t("saveSearch", {}, {})}
            </button>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {properties.length === 0 ? (
          <EmptyState
            title={t("noProperties")}
            message={t("tryAdjustingFilters")}
          />
        ) : (
          properties.map((prop) => {
            const [isFav, setIsFav] = useState(false);

            useEffect(() => {
              setIsFav(isFavorite(prop.id));
            }, [prop.id]);

            const toggleFavorite = () => {
              if (isFav) {
                removeFavorite(prop.id);
                setIsFav(false);
              } else {
                addFavorite(prop.id);
                setIsFav(true);
              }
            };

            const coverImage =
              prop.images?.find((img) => img.is_cover)?.image_url ||
              prop.images?.[0]?.image_url ||
              null;

            return (
              <article
                key={prop.id}
                className="border rounded-lg p-4 hover:shadow-md transition relative"
              >
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleFavorite();
                  }}
                  className="absolute top-2 right-2 p-2 bg-white/90 rounded-full hover:bg-white transition"
                >
                  {isFav ? (
                    <Heart className="w-5 h-5 text-red-500 fill-red-500" />
                  ) : (
                    <Heart className="w-5 h-5 text-gray-400 hover:text-red-500" />
                  )}
                </button>
                {coverImage && (
                  <img
                    src={coverImage}
                    alt={prop.title}
                    className="w-full h-48 object-cover rounded mb-2"
                  />
                )}
                <Link href={`/estates/${prop.slug}`} className="block">
                  <h3 className="font-bold text-lg">{prop.title}</h3>
                </Link>
                <p className="text-gray-600 text-sm">
                  {prop.city} · {t(prop.property_type, {}, {})} ·{" "}
                  {t(prop.listing_type, {}, {})}
                </p>
                {prop.price && (
                  <p className="font-bold mt-1">
                    {prop.currency} {prop.price.toLocaleString()}
                  </p>
                )}
              </article>
            );
          })
        )}
      </div>
      {count > 0 && (
        <div className="mt-6">
          <p className="text-gray-600 text-sm mb-2">
            {count} {t("propertiesFound")}
          </p>
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
