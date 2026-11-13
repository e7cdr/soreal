const PROPERTY_TYPE_LABELS = {
  house: "House",
  apartment: "Apartment",
  land: "Land",
  commercial: "Commercial",
  villa: "Villa",
};

const LISTING_TYPE_LABELS = {
  sale: "For Sale",
  rent: "For Rent",
};

function formatAmount(value) {
  const amount = Number(value);
  if (Number.isNaN(amount)) return null;
  return amount.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatDecimal(value) {
  const amount = Number(value);
  if (Number.isNaN(amount)) return null;
  return amount.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function stripHtml(value) {
  return (value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Build the shareable text for one estate, mirroring the social-post caption
 * and ending with the internal ID so agents can trace the listing.
 */
export function buildEstateCopyText(estate) {
  const lines = [];
  lines.push(`🏠 ${estate.title || ""}`.trim());
  lines.push("");

  const price = formatAmount(estate.price);
  if (price) {
    lines.push(`💰 Price: ${[estate.currency, price].filter(Boolean).join(" ")}`);
  }

  if (estate.bedrooms !== null && estate.bedrooms !== undefined && estate.bedrooms !== "") {
    lines.push(`🛏️ Bedrooms: ${estate.bedrooms}`);
  }
  if (estate.bathrooms !== null && estate.bathrooms !== undefined && estate.bathrooms !== "") {
    lines.push(`🚽 Bathrooms: ${estate.bathrooms}`);
  }
  if (estate.area_sqm !== null && estate.area_sqm !== undefined && estate.area_sqm !== "") {
    const area = formatDecimal(estate.area_sqm);
    if (area) lines.push(`📐 Area: ${area} m²`);
  }

  lines.push("");

  const location = [estate.city, estate.province].filter(Boolean).join(", ");
  if (location) {
    lines.push(`📍 Location: ${location}`);
  }

  const address = (estate.address || "").trim();
  if (address && address !== location) {
    lines.push(`🗺️ Address: ${address}`);
  }

  if (estate.property_type) {
    lines.push(
      `🏷️ Type: ${PROPERTY_TYPE_LABELS[estate.property_type] || estate.property_type}`,
    );
  }
  if (estate.listing_type) {
    lines.push(
      `📋 Listing: ${LISTING_TYPE_LABELS[estate.listing_type] || estate.listing_type}`,
    );
  }

  const description = stripHtml(estate.description);
  if (description) {
    lines.push("");
    lines.push(`📝 ${description}`);
  }

  lines.push("");
  lines.push("Contact us to schedule a visit!");
  lines.push("");
  lines.push(
    "#RealEstate #PropertyForSale #PropertyForRent #SOREALEstate #DominicanRepublic",
  );

  if (estate.custom_id) {
    lines.push("");
    lines.push(`🆔 ID: ${estate.custom_id}`);
  }

  return lines.join("\n");
}

export function buildEstatesCopyText(estates) {
  return estates
    .map(buildEstateCopyText)
    .join("\n\n━━━━━━━━━━━━━━━━━━━━\n\n");
}
