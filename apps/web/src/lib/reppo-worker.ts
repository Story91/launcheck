import { mapVerdictToStatus, reportToArtifact, ReppoBusyError, type ReppoClient } from "@tenderhound/core";
import type { ReportStore } from "@/lib/store";

export const MAX_REPPO_ATTEMPTS = 3;

export interface TickResult {
  submitted?: string;
  settled?: string;
}

/**
 * One worker tick (called by cron every minute). Reppo allows one pending evaluation per account, so:
 * 1. if an evaluation is pending, poll it and apply the verdict when settled (a poll that keeps failing gives up);
 * 2. otherwise submit the next queued report.
 */
export async function runReppoTick(store: ReportStore, reppo: ReppoClient): Promise<TickResult> {
  const pending = await store.findReppoPending();
  if (pending?.reppo) {
    const now = new Date().toISOString();
    try {
      const verdict = await reppo.get(pending.reppo.evalId);
      if (verdict.status === "PENDING") return {};
      await store.upsert({
        ...pending,
        status: mapVerdictToStatus(verdict),
        reppo: { ...verdict, submittedAt: pending.reppo.submittedAt, sandbox: pending.reppo.sandbox ?? false },
        updatedAt: now,
      });
      return { settled: pending.noticeId };
    } catch (e) {
      const pollFailures = (pending.reppo.pollFailures ?? 0) + 1;
      const giveUp = pollFailures >= MAX_REPPO_ATTEMPTS || (e as { status?: number }).status === 404;
      await store.upsert({
        ...pending,
        status: giveUp ? "unverified" : pending.status,
        reppo: { ...pending.reppo, pollFailures, status: giveUp ? "FAILED" : pending.reppo.status },
        error: giveUp ? `Reppo polling failed ${pollFailures} times: ${(e as Error).message}` : pending.error,
        updatedAt: now,
      });
      return {};
    }
  }

  const next = await store.nextReppo();
  if (!next) return {};
  const report = await store.get(next.noticeId);
  if (!report || report.status !== "pending_verification") {
    await store.dequeueReppo(next.noticeId);
    return {};
  }

  try {
    const { evalId } = await reppo.submit({ ...reportToArtifact(report), settlementMinutes: 10 });
    const submittedAt = new Date().toISOString();
    await store.upsert({
      ...report,
      reppo: { evalId, sandbox: reppo.sandbox, status: "PENDING", score: null, decision: null, confidence: null, critique: null, evidenceBasis: null, submittedAt, settledAt: null },
      updatedAt: submittedAt,
    });
    await store.dequeueReppo(next.noticeId);
    return { submitted: next.noticeId };
  } catch (e) {
    const attempts = await store.incrementReppoAttempts(next.noticeId);
    if (!(e instanceof ReppoBusyError) && attempts >= MAX_REPPO_ATTEMPTS) {
      await store.upsert({ ...report, status: "unverified", error: `Reppo submission failed ${attempts} times: ${(e as Error).message}`, updatedAt: new Date().toISOString() });
      await store.dequeueReppo(next.noticeId);
    }
    return {};
  }
}
