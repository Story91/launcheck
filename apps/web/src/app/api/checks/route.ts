import { json } from "@/lib/launchcheck/fixture-mode";

export const dynamic = "force-dynamic";

/** Start a LaunchCheck run. Until the Kite executor is online every valid request answers "live runs paused". */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_url" }, 400);
  }
  const raw = typeof body === "object" && body !== null && "url" in body ? (body as { url: unknown }).url : null;
  let url: URL | null = null;
  try {
    url = typeof raw === "string" ? new URL(raw) : null;
  } catch {
    url = null;
  }
  if (!url || (url.protocol !== "https:" && url.protocol !== "http:")) return json({ error: "invalid_url" }, 400);
  return json({ error: "live_runs_paused", reason: "executor_offline", galleryUrl: "/gallery" }, 503);
}
