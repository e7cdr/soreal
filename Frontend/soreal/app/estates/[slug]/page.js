import { headers } from "next/headers";
import EstateDetailLoader from "./EstateDetailLoader";

function plainText(value) {
  return (value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value, max = 200) {
  if (!value || value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

async function resolveBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");

  try {
    const headerList = await headers();
    const host = headerList.get("x-forwarded-host") || headerList.get("host");
    if (host) {
      const isLocal = /^(localhost|127\.|0\.0\.0\.0|\[::1\])/i.test(host);
      const protocol = headerList.get("x-forwarded-proto") || (isLocal ? "http" : "https");
      return `${protocol}://${host}`;
    }
  } catch {
    // headers() is unavailable outside a request context.
  }

  return "";
}

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const slug = Array.isArray(resolvedParams.slug) ? resolvedParams.slug[0] : resolvedParams.slug;

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"}/api/estates/properties/${slug}/`,
      { cache: "no-store" },
    );
    if (!response.ok) return { title: "Estate" };

    const estate = await response.json();
    const coverImage =
      estate.images?.find((img) => img.is_cover)?.image_url ||
      estate.images?.[0]?.image_url ||
      null;

    const baseUrl = await resolveBaseUrl();
    const canonicalUrl = baseUrl ? `${baseUrl}/estates/${slug}` : `/estates/${slug}`;
    const description = truncate(
      plainText(estate.description) || `Property in ${estate.city || "the Dominican Republic"}`,
    );

    // Facebook requires an absolute image URL; dimensions are the standard
    // 1.91:1 Open Graph size so the preview card is generated immediately.
    const ogImages = coverImage
      ? [{ url: coverImage, width: 1200, height: 630, alt: estate.title }]
      : [];

    return {
      title: estate.title,
      description,
      alternates: { canonical: canonicalUrl },
      openGraph: {
        title: estate.title,
        description,
        type: "website",
        url: canonicalUrl,
        images: ogImages,
        siteName: "SOREAL Estate",
      },
      twitter: {
        card: "summary_large_image",
        title: estate.title,
        description,
        images: coverImage ? [coverImage] : [],
      },
    };
  } catch {
    return { title: "Estate" };
  }
}

export default async function EstateDetailPage({ params }) {
  const resolvedParams = await params;
  const slug = Array.isArray(resolvedParams.slug) ? resolvedParams.slug[0] : resolvedParams.slug;
  return <EstateDetailLoader slug={slug} />;
}
