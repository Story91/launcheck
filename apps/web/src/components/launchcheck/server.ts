import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { reportSchema } from "./contract";
import { isFixture } from "./format";
import { fixtureReport } from "./mocks/fixtures";
export function appOrigin() { if (process.env.NEXT_PUBLIC_APP_URL) { const url = new URL(process.env.NEXT_PUBLIC_APP_URL); if (url.protocol === "https:" || (process.env.NODE_ENV !== "production" && url.hostname === "localhost")) return url.origin; } if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`; return process.env.NODE_ENV === "production" ? "https://tendr-ecru.vercel.app" : "http://localhost:3187"; }
export const getPublicReport = cache(async (id: string) => {
  if (!/^[a-zA-Z0-9_-]{1,160}$/.test(id)) return { kind: "missing" as const };
  if (isFixture(id)) return { kind: "ok" as const, report: fixtureReport(id, id === "fx_running" ? 0 : 5) };
  try { const response = await fetch(`${appOrigin()}/api/checks/${encodeURIComponent(id)}`, { cache: "no-store", signal: AbortSignal.timeout(10000) }); if (response.status === 404) return { kind: "missing" as const }; if (!response.ok) return { kind: "unavailable" as const }; const parsed = reportSchema.safeParse(await response.json()); return parsed.success ? { kind: "ok" as const, report: parsed.data } : { kind: "unavailable" as const }; } catch { return { kind: "unavailable" as const }; }
});
// Ownership is refreshed client-side by same-origin fetch; shared metadata never forwards creator cookies.
export async function requestOrigin() { const requestHeaders = await headers(); const host = requestHeaders.get("host"); if (process.env.NODE_ENV !== "production" && host && /^localhost:\d+$/.test(host)) return `http://${host}`; return appOrigin(); }
