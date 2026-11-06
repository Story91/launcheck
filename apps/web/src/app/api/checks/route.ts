import { BlockedUrlError, tierSchema } from "@tendr/core";
import { after } from "next/server";
import { TIER_BUDGET_USD, dailyCapUsd, executeRun, executorConfigured, liveRunsEnabled, newCreatorToken, newRunId, queuedReport, sha256, today } from "@/lib/launchcheck/executor";
import { json } from "@/lib/launchcheck/fixture-mode";
import { assertPublicUrlLive } from "@/lib/launchcheck/free-runtime";
import { runStore } from "@/lib/launchcheck/run-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// The run (free checks and Kite purchases) continues in after() within this function's lifetime.
export const maxDuration = 300;

const RUNS_PER_IP_PER_HOUR = 3;
const CACHE_MS = 24 * 3600 * 1000;

/** Start a LaunchCheck run: free checks on our server, then paid checks bought by the agent within the tier budget. */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "invalid_url" }, 400);
  }
  let url: URL;
  try {
    url = new URL(String(body?.url ?? ""));
  } catch {
    return json({ error: "invalid_url" }, 400);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return json({ error: "invalid_url" }, 400);
  const tier = tierSchema.safeParse(body.tier ?? "standard");
  if (!tier.success) return json({ error: "invalid_url" }, 400);

  if (!liveRunsEnabled()) return json({ error: "live_runs_paused", reason: executorConfigured() ? "paused" : "executor_offline", galleryUrl: "/gallery" }, 503);

  try {
    await assertPublicUrlLive(url.href);
  } catch (e) {
    if (e instanceof BlockedUrlError) return json({ error: "blocked_url", reason: e.reason }, 403);
    return json({ error: "invalid_url" }, 400);
  }

  const store = runStore();
  const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0]!.trim();
  const ipHash = sha256(`lc-ip:${ip}`);

  const cached = await store.latestDoneForOrigin(url.origin, new Date(Date.now() - CACHE_MS));
  if (cached) {
    const report = await store.getReport(cached);
    return json({ id: cached, reportUrl: `/check/${cached}`, cached: true, checkedAt: report?.finishedAt ?? undefined }, 200);
  }
  if ((await store.countRecentByIp(ipHash, new Date(Date.now() - 3600_000))) >= RUNS_PER_IP_PER_HOUR) {
    return json({ error: "rate_limited", retryAfterSec: 3600 }, 429);
  }
  if ((await store.dailySpend(today())) + TIER_BUDGET_USD[tier.data] > dailyCapUsd()) {
    return json({ error: "live_runs_paused", reason: "daily_cap", galleryUrl: "/gallery" }, 503);
  }

  const id = newRunId();
  const token = newCreatorToken();
  const target = url.href;
  await store.createRun(queuedReport(id, target, tier.data), { ipHash, creatorHash: sha256(token) });
  after(() => executeRun(id, target, tier.data));

  const res = json({ id, reportUrl: `/check/${id}`, cached: false }, 201);
  res.headers.append("set-cookie", `lc_creator=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 24 * 3600}`);
  return res;
}
