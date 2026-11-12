/** @type {import('next').NextConfig} */
const nextConfig = {
  /* reactCompiler disabled for build stability */
  allowedDevOrigins: ['192.168.18.5', 'localhost'],
  sitemaps: async () => {
    const baseUrl =
      process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
    try {
      const res = await fetch(`${baseUrl}/api/estates/properties/?status=available&limit=1000`);
      if (!res.ok) return [];
      const data = await res.json();
      const results = data.results || [];
      return results.map((estate) => ({
        url: `/estates/${estate.slug}`,
        lastmod: estate.updated_at,
        changeFrequency: "weekly",
        priority: 0.8,
      }));
    } catch {
      return [];
    }
  },
};

export default nextConfig;
