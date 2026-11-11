import { fetchEstate } from "@/lib/api";
import EstateDetailClient from "./EstateDetailClient";

export async function generateMetadata({ params }) {
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  try {
    const estate = await fetchEstate(slug);
    return {
      title: estate.title,
      description: estate.description || `Property in ${estate.city}`,
    };
  } catch {
    return { title: "Estate" };
  }
}

export default async function EstateDetailPage({ params }) {
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const estate = await fetchEstate(slug);

  return <EstateDetailClient estate={estate} />;
}
