import Link from "next/link";
import { useState, useEffect } from "react";
import { useTranslation } from "@/app/components/LanguageProvider";
import {
  isFavorite,
  addFavorite,
  removeFavorite,
} from "@/lib/favorites";
import { Heart } from "lucide-react";

export default function PropertyCard({ property }) {
  const { t } = useTranslation();
  const [isFav, setIsFav] = useState(false);
  const coverImage =
    property.images?.find((img) => img.is_cover)?.image_url ||
    property.images?.[0]?.image_url ||
    null;

  const typeLabel = t(property.property_type, {}, {});
  const listingLabel = t(property.listing_type, {}, {});

  useEffect(() => {
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
    <article className="border rounded-lg p-4 hover:shadow-md transition relative">
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
      <Link href={`/estates/${property.slug}`} className="block">
        <h3 className="font-bold text-lg">{property.title}</h3>
      </Link>
      <p className="text-gray-600 text-sm">
        {property.city} · {typeLabel} · {listingLabel}
      </p>
      {property.price && (
        <p className="font-bold mt-1">
          {property.currency} {property.price.toLocaleString()}
        </p>
      )}
    </article>
  );
}
