import Link from "next/link";
import { useState, useEffect } from "react";
import { useTranslation } from "@/app/components/LanguageProvider";
import {
  isFavorite,
  addFavorite,
  removeFavorite,
} from "@/lib/favorites";
import { Heart } from "lucide-react";
import StaleBadge from "@/app/components/StaleBadge";

function normalizePhoneForWhatsApp(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (!digits.startsWith("1")) {
    return `1${digits}`;
  }
  return digits;
}

function buildWhatsAppUrl(phone, text) {
  const normalized = normalizePhoneForWhatsApp(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
}

export default function PropertyCard({ property, selected = false, onToggleSelected }) {
  const { translate: t } = useTranslation();
  const [isFav, setIsFav] = useState(false);
  const coverImage =
    property.images?.find((img) => img.is_cover)?.image_url ||
    property.images?.[0]?.image_url ||
    null;

  const typeLabel = t(property.property_type);
  const listingLabel = t(property.listing_type);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsFav(isFavorite(property.id));
  }, [property.id]);

  const toggleFavorite = () => {
    if (isFav) {
      removeFavorite(property.id);
      setIsFav(false);
    } else {
      addFavorite(property.id);
      setIsFav(true);
    }
  };

  return (
    <article
      className={`border rounded-lg p-4 hover:shadow-md transition relative ${
        selected ? "property-card-selected" : ""
      }`.trim()}
    >
      {onToggleSelected && (
        <label className="property-card-check" title={t("selectEstate", { title: property.title })}>
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelected(property.id)}
            aria-label={t("selectEstate", { title: property.title })}
          />
        </label>
      )}
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
          alt={property.title}
          className="w-full h-48 object-cover rounded mb-2"
        />
      )}
      <div className="flex items-baseline gap-2 mb-1">
        <Link href={`/estates/${property.slug}`} className="block">
          <h3 className="font-bold text-lg">{property.title}</h3>
        </Link>
        <StaleBadge createdAt={property.created_at} />
      </div>
      <p className="text-gray-600 text-sm">
        {property.city} · {typeLabel} · {listingLabel}
      </p>
      {property.custom_id && (
        <p className="mt-1 text-xs font-semibold tracking-wide text-[var(--text-muted)]">
          {t("customId")}: {property.custom_id}
        </p>
      )}
      {property.price && (
        <p className="font-bold mt-1">
          {property.currency} {property.price.toLocaleString()}
        </p>
      )}
      {property.source_site && property.source_status !== "verified" && (
        <p className="mt-1 text-xs font-semibold text-[var(--text-muted)]">
          <span
            className="rounded-md bg-[var(--surface-muted)] px-2 py-0.5"
          >
            {t("fromSource", { site: property.source_site })}
          </span>
        </p>
      )}
      {property.phone && (
        <a
          href={buildWhatsAppUrl(property.phone, t("whatsappContactEstate", { title: property.title })) || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
        >
          <span className="text-green-600">📱</span>
          {t("whatsappContact")}
        </a>
      )}
    </article>
  );
}
