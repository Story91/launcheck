import { createHash, randomBytes } from "node:crypto";
import type { LaunchCheckReport, LaunchCheckTier } from "@tendr/core";
import { emptyReport, runLaunchCheck } from "@tendr/core/server";
import { kpassBuy } from "@/lib/launchcheck/buyer";
import { runFreeChecksLive } from "@/lib/launchcheck/free-runtime";
import { kpassFilesFromEnv } from "@/lib/launchcheck/kpass-runtime";
import { runStore } from "@/lib/launchcheck/run-store";

export const TIER_BUDGET_USD: Record<LaunchCheckTier, number> = { quick: 0.05, standard: 0.15, full: 0.25 };
export const AGENT = { kiteAgentId: "…d523", agentType: "claude", ownerMasked: "co***@…" };

export const dailyCapUsd = () => Number(process.env.LAUNCHCHECK_DAILY_CAP_USD ?? "1.5");
export const executorConfigured = () => kpassFilesFromEnv(process.env) !== null;
/** Live runs need the Kite credentials and the owner's explicit switch (LAUNCHCHECK_LIVE=1). */
export const liveRunsEnabled = () => executorConfigured() && process.env.LAUNCHCHECK_LIVE === "1";
export const today = () => new Date().toISOString().slice(0, 10);
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const newRunId = () => `lc_${randomBytes(9).toString("base64url").replace(/[-_]/g, "x")}`;
export const newCreatorToken = () => randomBytes(24).toString("base64url");

export function queuedReport(id: string, url: string, tier: LaunchCheckTier): LaunchCheckReport {
  return emptyReport({ id, url, tier, budgetUsd: TIER_BUDGET_USD[tier] }, { now: () => new Date(), agent: AGENT });
}

/** Runs the whole check; called inside after() from POST /api/checks. Never throws: failures end as status "failed". */
export async function executeRun(id: string, url: string, tier: LaunchCheckTier): Promise<void> {
  const store = runStore();
  try {
    await runLaunchCheck(
      { id, url, tier, budgetUsd: TIER_BUDGET_USD[tier] },
      {
        runFree: runFreeChecksLive,
        buyer: kpassBuy,
        saveImage: async (evidenceId, png) => {
          const imageId = `${id}_${evidenceId}`;
          await store.saveImage(imageId, id, png);
          return `/api/evidence/${imageId}`;
        },
        save: (r) => store.saveReport(r),
        canSpend: (amount) => store.reserveDailySpend(today(), amount, dailyCapUsd()),
        idempotencyKey: (checkId) => `${id}-${checkId}`,
        now: () => new Date(),
        agent: AGENT,
      },
    );
  } catch (e) {
    const current = (await store.getReport(id)) ?? queuedReport(id, url, tier);
    await store.saveReport({ ...current, status: "failed", progress: "failed", finishedAt: new Date().toISOString(), error: `The run stopped unexpectedly: ${(e as Error).message.slice(0, 200)}` });
  }
}
