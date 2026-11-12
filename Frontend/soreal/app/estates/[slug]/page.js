import EstateDetailLoader from "./EstateDetailLoader";

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const slug = Array.isArray(resolvedParams.slug) ? resolvedParams.slug[0] : resolvedParams.slug;
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"}/api/estates/properties/${slug}/`);
    if (!response.ok) return { title: "Estate" };
    const estate = await response.json();
    const coverImage =
      estate.images?.find((img) => img.is_cover)?.image_url ||
      estate.images?.[0]?.image_url ||
      null;
    return {
      title: estate.title,
      description: estate.description || `Property in ${estate.city}`,
      openGraph: {
        title: estate.title,
        description: estate.description || `Property in ${estate.city}`,
        type: "website",
        url: `/estates/${slug}`,
        images: coverImage ? [{ url: coverImage }] : [],
        siteName: "SOREAL Estate",
      },
      twitter: {
        card: "summary_large_image",
        title: estate.title,
        description: estate.description || `Property in ${estate.city}`,
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
