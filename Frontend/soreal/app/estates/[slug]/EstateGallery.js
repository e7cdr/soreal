"use client";

import { useMemo, useState } from "react";
import { ImageOff } from "lucide-react";

export default function EstateGallery({ images = [], title, t }) {
  const ordered = useMemo(() => {
    const usable = (images || []).filter((image) => image?.image_url);
    const covers = usable.filter((image) => image.is_cover);
    const rest = usable.filter((image) => !image.is_cover);
    return [...covers, ...rest];
  }, [images]);

  const [activeIndex, setActiveIndex] = useState(0);

  if (!ordered.length) {
    return (
      <div className="estate-gallery-empty">
        <ImageOff size={26} aria-hidden="true" />
        <span>{t("noImagesAvailable")}</span>
      </div>
    );
  }

  const safeIndex = Math.min(activeIndex, ordered.length - 1);
  const active = ordered[safeIndex];

  return (
    <div className="estate-gallery">
      <figure className="estate-hero">
        <img src={active.image_url} alt={active.caption || title} />
      </figure>

      {ordered.length > 1 && (
        <div className="estate-thumbs" role="tablist" aria-label={t("estatePhotos")}>
          {ordered.map((image, index) => (
            <button
              key={image.id ?? `${image.image_url}-${index}`}
              type="button"
              role="tab"
              aria-selected={index === safeIndex}
              aria-label={image.caption || `${title} ${index + 1}`}
              className={`estate-thumb ${index === safeIndex ? "estate-thumb-active" : ""}`.trim()}
              onClick={() => setActiveIndex(index)}
            >
              <img
                src={image.image_url}
                alt={image.caption || `${title} ${index + 1}`}
                loading="lazy"
                decoding="async"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
