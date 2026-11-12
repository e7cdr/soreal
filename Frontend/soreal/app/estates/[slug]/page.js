import EstateDetailLoader from "./EstateDetailLoader";

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const slug = Array.isArray(resolvedParams.slug) ? resolvedParams.slug[0] : resolvedParams.slug;
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"}/api/estates/properties/${slug}/`);
    if (!response.ok) return { title: "Estate" };
    const estate = await response.json();
    return {
      title: estate.title,
      description: estate.description || `Property in ${estate.city}`,
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
