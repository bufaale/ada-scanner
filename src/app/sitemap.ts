import type { MetadataRoute } from "next";

const BASE = "https://accessiscan.piposlab.com";

const STATIC_ROUTES: Array<{ path: string; priority: number; changeFreq: "daily" | "weekly" | "monthly" }> = [
  { path: "/", priority: 1.0, changeFreq: "weekly" },
  { path: "/pricing", priority: 0.9, changeFreq: "weekly" },
  { path: "/free/wcag-scanner", priority: 0.9, changeFreq: "weekly" },
  { path: "/overlay-detector", priority: 0.7, changeFreq: "monthly" },
  { path: "/why-not-overlays", priority: 0.6, changeFreq: "monthly" },
  { path: "/blog", priority: 0.7, changeFreq: "weekly" },
  { path: "/login", priority: 0.4, changeFreq: "monthly" },
  { path: "/signup", priority: 0.5, changeFreq: "monthly" },
  { path: "/terms", priority: 0.3, changeFreq: "monthly" },
  { path: "/privacy", priority: 0.3, changeFreq: "monthly" },
  { path: "/refund", priority: 0.3, changeFreq: "monthly" },
];

// Blog posts known at build time. The blog index reads from src/content/blog/registry.ts
// — eventually this could read from the same source, but hard-coding here keeps the
// sitemap simple and avoids server-side imports at build.
const BLOG_SLUGS = [
  "accessibe-ftc-lessons",
  "doj-title-ii-runway",
  "en-301-549-forbidden-ids",
  "overlay-lawsuit-guide",
  "wcag-audit-cost-comparison",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    ...STATIC_ROUTES.map(({ path, priority, changeFreq }) => ({
      url: `${BASE}${path}`,
      lastModified: now,
      changeFrequency: changeFreq,
      priority,
    })),
    ...BLOG_SLUGS.map((slug) => ({
      url: `${BASE}/blog/${slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
