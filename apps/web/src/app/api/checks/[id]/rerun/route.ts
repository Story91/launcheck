import { isLaunchCheckFixtureId } from "@tendr/core";
import { json } from "@/lib/launchcheck/fixture-mode";
import { after } from "next/server";
import { runStore } from "@/lib/launchcheck/run-store";
import { creatorToken, isRunOwner } from "@/lib/launchcheck/owner";
import { isLaunchcheckOperator } from "@/lib/launchcheck/operator";
import { dailyCapUsd, executeRun, liveRunsEnabled, newRunId, queuedReport, sha256, TIER_BUDGET_USD, today } from "@/lib/launchcheck/executor";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Re-check only the problems of a report. Fixture: fx_problems reruns into fx_fixed. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id === "fx_problems") return json({ id: "fx_fixed", reportUrl: "/check/fx_fixed", estimateUsd: 0.03 }, 201);
  if (isLaunchCheckFixtureId(id)) return json({ error: "live_runs_paused", reason: "paused", galleryUrl: "/gallery" }, 503);
  const store = runStore();
  if (await store.getSetting("payment_hold") === "true") return json({ error: "live_runs_paused", reason: "payment_hold" }, 503);
  const parent = await store.getReport(id);
  if (!parent) return json({ error: "not_found" }, 404);
  if (!(await isRunOwner(req, id))) return json({ error: "forbidden" }, 403);
  if (!["done", "failed", "unreachable"].includes(parent.status)) return json({ error: "run_in_progress" }, 409);
  if (!liveRunsEnabled() && !isLaunchcheckOperator(req)) return json({ error: "live_runs_paused", reason: "paused" }, 503);
  const ipHash = sha256(`lc-ip:${(req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0]!.trim()}`);
  if (await store.countRecentByIp(ipHash, new Date(Date.now() - 3600000)) >= 3) return json({ error: "rate_limited", retryAfterSec: 3600 }, 429);
  if (await store.dailySpend(today()) + TIER_BUDGET_USD[parent.tier] > dailyCapUsd()) return json({ error: "live_runs_paused", reason: "daily_cap" }, 503);
  const nextId = newRunId();
  await store.createRun({ ...queuedReport(nextId, parent.url, parent.tier), parentId: id }, { ipHash, creatorHash: sha256(creatorToken(req)!) });
  after(() => executeRun(nextId, parent.url, parent.tier, id));
  return json({ id: nextId, reportUrl: `/check/${nextId}`, estimateUsd: TIER_BUDGET_USD[parent.tier] }, 201);
}
