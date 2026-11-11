"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { fetchEstate } from "@/lib/api";
import { getFavorites } from "@/lib/favorites";
import { useTranslation } from "@/app/components/LanguageProvider";
import EmptyState from "@/app/components/EmptyState";

export default function FavoritesPage() {
  const { t } = useTranslation();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadFavorites();
  }, []);

  async function loadFavorites() {
    const favIds = getFavorites();
    if (favIds.length === 0) {
      setFavorites([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const properties = [];
    const errors = [];

    for (const id of favIds) {
      try {
        const estate = await fetchEstate(id);
        properties.push(estate);
      } catch (err) {
        errors.push(id);
      }
    }

    // Remove invalid favorite IDs
    if (errors.length > 0) {
      import("@/lib/favorites").then(({ removeFavorite }) => {
        errors.forEach((id) => removeFavorite(id));
      });
    }

    setFavorites(properties);
    setLoading(false);
  }

  const handleRemoveFavorite = (id) => {
    import("@/lib/favorites").then(({ removeFavorite }) => {
      removeFavorite(id);
      setFavorites((prev) => prev.filter((p) => p.id !== id));
    });
  };

  if (loading) return <div className="p-6">{t("loading")}</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{t("favorites", {}, {})}</h1>
        <Link
          href="/estates"
          className="text-blue-600 hover:underline text-sm"
        >
          ← {t("backToEstates", {}, {})}
        </Link>
      </div>

      {favorites.length === 0 && (
        <EmptyState
          title={t("noFavorites", {}, {})}
          message={t("noFavoritesMessage", {}, {})}
        />
      )}

      {favorites.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {favorites.map((prop) => (
            <article
              key={prop.id}
              className="border rounded-lg p-4 hover:shadow-md transition relative"
            >
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleRemoveFavorite(prop.id);
                }}
                className="absolute top-2 right-2 p-2 bg-white/90 rounded-full hover:bg-white transition"
              >
                <span className="text-red-500">✕</span>
              </button>
              {prop.images?.[0]?.image_url && (
                <img
                  src={prop.images[0].image_url}
                  alt={prop.title}
                  className="w-full h-48 object-cover rounded mb-2"
                />
              )}
              <Link href={`/estates/${prop.slug}`} className="block">
                <h3 className="font-bold text-lg">{prop.title}</h3>
              </Link>
              <p className="text-gray-600 text-sm">
                {prop.city}, {prop.province}
              </p>
              <p className="text-gray-600 text-sm capitalize">
                {prop.property_type} · {prop.listing_type}
              </p>
              {prop.price && (
                <p className="font-bold mt-1">
                  {prop.currency} {prop.price.toLocaleString()}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
