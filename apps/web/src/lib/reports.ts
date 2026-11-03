import { generateReport, type PipelineDeps, type Report } from "@tenderhound/core";
import type { ReportStore, StoredReport } from "@/lib/store";

type Generate = typeof generateReport;

export const RETRY_AFTER_SECONDS = 60;
/** A `generating` row older than this is considered abandoned (crash, timeout) and may be claimed again. */
export const STALE_GENERATION_MS = 5 * 60_000;

/** Only complete reports with a real (non-sandbox) independent verdict are sold. */
export function isSellable(report: Report): boolean {
  if (report.status !== "verified" && report.status !== "disputed") return false;
  if (report.partial) return false;
  if (report.reppo?.sandbox) return false;
  return true;
}

/**
 * Claims the notice atomically and runs the pipeline. Progress writes are serialised and awaited before the final
 * write, so a late progress update can never clobber a finished report. Returns "exists" when another run owns it.
 */
export async function startGeneration(
  noticeId: string,
  store: ReportStore,
  deps: PipelineDeps,
  generate: Generate = generateReport,
  onProgress?: (step: string) => void,
): Promise<"started" | "exists"> {
  if (!(await store.claimGeneration(noticeId, STALE_GENERATION_MS))) return "exists";

  let chain: Promise<void> = Promise.resolve();
  const report = await generate(noticeId, deps, (step) => {
    onProgress?.(step);
    chain = chain.then(() => store.setProgress(noticeId, step)).catch((e) => console.error("progress write failed", e));
  });
  await chain;
  await store.upsert({ ...report, progress: report.status === "failed" ? "failed" : "done" });
  if (report.status === "pending_verification") await store.enqueueReppo(noticeId);
  return "started";
}

/** What the public API and page may show. Withheld reports keep their verdict but lose signals, quotes and summary. */
export function publicView(report: StoredReport): StoredReport {
  if (report.status !== "withheld") return report;
  return { ...report, signals: [], summary: null, facts: report.facts ? { ...report.facts, notes: [], technicalRequirements: [], participationConditions: [] } : null };
}

export interface InternalResponse {
  status: 200 | 401 | 404 | 409;
  body: unknown;
}

function secretsMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** x402 upstream contract: 200 only for sellable reports, 409 otherwise so the paywall never settles for nothing. */
export async function internalReportResponse(
  store: ReportStore,
  noticeId: string,
  providedSecret: string | null,
  expectedSecret: string,
): Promise<InternalResponse> {
  if (!providedSecret || !secretsMatch(providedSecret, expectedSecret)) return { status: 401, body: { error: "unauthorized" } };
  const report = await store.get(noticeId);
  if (!report) return { status: 404, body: { error: "report not found" } };
  if (!isSellable(report)) return { status: 409, body: { status: report.status, retryAfterSeconds: RETRY_AFTER_SECONDS } };
  const { progress: _p, ...publicReport } = report;
  return { status: 200, body: publicReport };
}
