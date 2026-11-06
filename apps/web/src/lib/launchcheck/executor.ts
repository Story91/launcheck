import { ServClient } from "@tendr/core";
import { createHash, randomBytes } from "node:crypto";
import type { LaunchCheckReport, LaunchCheckTier } from "@tendr/core";
import { emptyReport, runLaunchCheck, launchCheckReasoning, runBrowserJourney } from "@tendr/core/server";
import { kpassBuy } from "@/lib/launchcheck/buyer";
import { runFreeChecksLive } from "@/lib/launchcheck/free-runtime";
import { kpassFilesFromEnv } from "@/lib/launchcheck/kpass-runtime";
import { runStore } from "@/lib/launchcheck/run-store";

export const TIER_BUDGET_USD: Record<LaunchCheckTier, number> = { quick: 0.05, standard: 0.15, full: 0.25 };
export const AGENT = { kiteAgentId: "…d523", agentType: "claude", ownerMasked: "co***@…" };

export const dailyCapUsd = () => Number(process.env.LAUNCHCHECK_DAILY_CAP_USD ?? "1.5");
export const executorConfigured = () => kpassFilesFromEnv(process.env) !== null;
/** Live runs need the Kite credentials and the owner's explicit switch (LAUNCHCHECK_LIVE=1). */
export const liveRunsEnabled = () => executorConfigured() && process.env.LAUNCHCHECK_LIVE === "1" && (!process.env.LAUNCHCHECK_LIVE_UNTIL || Date.parse(process.env.LAUNCHCHECK_LIVE_UNTIL) > Date.now());
export const today = () => new Date().toISOString().slice(0, 10);
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const newRunId = () => `lc_${randomBytes(9).toString("base64url").replace(/[-_]/g, "x")}`;
export const newCreatorToken = () => randomBytes(24).toString("base64url");

export function queuedReport(id: string, url: string, tier: LaunchCheckTier): LaunchCheckReport {
  return emptyReport({ id, url, tier, budgetUsd: TIER_BUDGET_USD[tier] }, { now: () => new Date(), agent: AGENT });
}

/** Runs the whole check; called inside after() from POST /api/checks. Never throws: failures end as status "failed". */
export async function executeRun(id: string, url: string, tier: LaunchCheckTier, parentId?: string): Promise<void> {
  const store = runStore(); const spendDay = today();
  try {
    await runLaunchCheck(
      { id, url, tier, budgetUsd: TIER_BUDGET_USD[tier], parentId },
      {
        previousReport: parentId ? (await store.getReport(parentId)) ?? undefined : undefined,
        ...(process.env.SERV_API_KEY ? { reasoning: launchCheckReasoning(new ServClient({ apiKey: process.env.SERV_API_KEY, timeoutMs: 45000 }), process.env.SERV_MODEL ?? "gpt-6-luna", { promptGuard: process.env.LAUNCHCHECK_PROMPT_GUARD === "1" }) } : {}),
        navigateBrowser: runBrowserJourney,
        runFree: runFreeChecksLive,
        buyer: kpassBuy,
        saveImage: async (evidenceId, png) => {
          const imageId = `${id}_${evidenceId}`;
          await store.saveImage(imageId, id, png);
          return `/api/evidence/${imageId}`;
        },
        save: (r) => store.saveReport(r),
        settleSpend: async (reserved, actual) => { await store.settleDailySpend(spendDay,reserved,actual,dailyCapUsd()); if (actual === null) await store.setSetting("payment_hold","true"); },
        canSpend: (amount) => store.reserveDailySpend(spendDay, amount, dailyCapUsd()),
        idempotencyKey: (checkId) => `${id}-${checkId}`,
        now: () => new Date(),
        agent: AGENT,
      },
    );
  } catch (e) {
    const current = (await store.getReport(id)) ?? queuedReport(id, url, tier);
    current.checks = current.checks.map(c => c.state === "pending" || c.state === "running" ? { ...c, state: "not_checked", notCheckedReason: "timeout" } : c);
    current.summary = { checksRun: current.checks.filter(c => c.state === "clear" || c.state === "problem").length, problems: current.findings.length, nothingFound: current.checks.filter(c => c.state === "clear").length, notChecked: current.checks.filter(c => c.state === "not_checked").length };
    await store.saveReport({ ...current, status: "failed", progress: "failed", finishedAt: new Date().toISOString(), error: "The run stopped unexpectedly. Existing evidence and payment records are retained. Resolve any unknown payment before retrying." });
  }
}
