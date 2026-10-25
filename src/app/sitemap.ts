import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/pricing", "/faq", "/terms", "/privacy", "/contact", "/sign-in", "/sign-up"].map((p) => ({
    url: `${BASE}${p}`,
  }));
}
