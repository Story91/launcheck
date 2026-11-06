import { launchCheckFixtureAgent } from "@tendr/core";
import { AGENT, dailyCapUsd, executorConfigured, liveRunsEnabled, today } from "@/lib/launchcheck/executor";
import { json } from "@/lib/launchcheck/fixture-mode";
import { runKpass, sanitizeAllowance } from "@/lib/launchcheck/kpass-runtime";
import { runStore } from "@/lib/launchcheck/run-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type Meter = ReturnType<typeof sanitizeAllowance>;
let cache: { at: number; meter: Meter; online: boolean } | null = null;

/** The allowance as kpass reports it, read at most once a minute per instance. Never mocked in production. */
async function readAllowance(): Promise<{ meter: Meter; online: boolean }> {
  if (cache && Date.now() - cache.at < 60_000) return cache;
  try {
    const r = await runKpass(["allowance", "status"], 30_000);
    cache = { at: Date.now(), meter: sanitizeAllowance(r.json, new Date().toISOString()), online: r.exitCode === 0 };
  } catch {
    cache = { at: Date.now(), meter: null, online: false };
  }
  return cache;
}

/** Kite agent identity and spending state. ?fixture=1 serves the example. */
export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get("fixture") === "1") return json(launchCheckFixtureAgent);
  const configured = executorConfigured();
  const { meter, online } = configured ? await readAllowance() : { meter: null, online: false };
  let spent = 0;
  try {
    spent = await runStore().dailySpend(today());
  } catch {
    spent = 0;
  }
  const cap = dailyCapUsd();
  const tomorrow = new Date(`${today()}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return json({
    agent: { ...AGENT, registeredAt: "2026-11-06T01:55:00Z" },
    allowance: meter ? { leftUsd: meter.leftUsd, limitUsd: meter.limitUsd, period: meter.period, resetsAt: meter.resetsAt, readAt: meter.readAt } : null,
    demo: { capUsd: cap, leftUsd: Math.max(0, Math.round((cap - spent) * 1e6) / 1e6), resetsAt: tomorrow.toISOString() },
    executor: { online, lastSeenAt: online && cache ? new Date(cache.at).toISOString() : null, where: "vercel" },
    liveRuns: liveRunsEnabled() && online && (await runStore().getSetting("payment_hold").catch(() => "true")) !== "true",
  });
}
