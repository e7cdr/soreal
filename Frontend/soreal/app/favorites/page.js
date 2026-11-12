"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { fetchEstate } from "@/lib/api";
import { getFavorites } from "@/lib/favorites";
import { useTranslation } from "@/app/components/LanguageProvider";
import EmptyState from "@/app/components/EmptyState";
import PageShell from "@/app/components/PageShell";

export default function FavoritesPage() {
  const { translate: t } = useTranslation();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFavorites();
  }, []);

  const handleRemoveFavorite = (id) => {
    import("@/lib/favorites").then(({ removeFavorite }) => {
      removeFavorite(id);
      setFavorites((prev) => prev.filter((p) => p.id !== id));
    });
  };

  if (loading) {
    return (
      <PageShell title={t("favorites")}>
        <div className="compact-card text-sm text-[var(--text-muted)]">{t("loading")}</div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={t("favorites")}
      actions={(
        <Link href="/estates" className="toolbar-button">
          ← {t("backToEstates")}
        </Link>
      )}
    >
      {favorites.length === 0 ? (
        <EmptyState
          title={t("noFavorites")}
          message={t("noFavoritesMessage")}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {favorites.map((prop) => (
            <article key={prop.id} className="compact-card relative transition hover:shadow-md">
              <button
                type="button"
                aria-label={t("removeFavorite")}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleRemoveFavorite(prop.id);
                }}
                className="absolute right-2 top-2 z-10 rounded-full bg-white/90 p-1.5 text-red-500 hover:bg-white"
              >
                ✕
              </button>
              {prop.images?.[0]?.image_url && (
                <img
                  src={prop.images[0].image_url}
                  alt={prop.title}
                  className="mb-2 h-36 w-full rounded object-cover"
                  loading="lazy"
                  decoding="async"
                />
              )}
              <Link href={`/estates/${prop.slug}`} className="block">
                <h3 className="text-base font-bold">{prop.title}</h3>
              </Link>
              <p className="text-xs text-[var(--text-muted)]">
                {prop.city}, {prop.province}
              </p>
              <p className="text-xs capitalize text-[var(--text-muted)]">
                {prop.property_type} · {prop.listing_type}
              </p>
              {prop.price && (
                <p className="mt-1 text-sm font-bold">
                  {prop.currency} {prop.price.toLocaleString()}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </PageShell>
  );
}
