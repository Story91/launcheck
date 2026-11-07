import type { MetadataRoute } from "next";
import { appOrigin } from "@/components/launchcheck/server";

// Public pages are indexable; API routes and the archived Tendr app are not.
export default function robots(): MetadataRoute.Robots {
  const origin = appOrigin();
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/tendr"] }], sitemap: `${origin}/sitemap.xml`, host: origin };
}
