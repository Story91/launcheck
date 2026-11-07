import type { MetadataRoute } from "next";
import { appOrigin } from "@/components/launchcheck/server";

// Static public pages plus the two recorded demo reports linked from the submission.
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = appOrigin();
  const paths = ["/", "/check", "/gallery", "/agents", "/api-docs", "/tools/link-preview", "/check/lc_9b00787167ca2371f7ac07a3", "/check/lc_KpScNuw45vmP"];
  return paths.map((path) => ({ url: `${origin}${path}`, changeFrequency: path.startsWith("/check/lc_") ? "never" : "weekly" }));
}
