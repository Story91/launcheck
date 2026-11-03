import { generateReport, type PipelineDeps, type Report } from "@tenderhound/core";
import type { ReportStore } from "@/lib/store";

type Generate = typeof generateReport;

const SELLABLE: ReadonlySet<Report["status"]> = new Set(["verified", "disputed"]);
export const RETRY_AFTER_SECONDS = 60;

function placeholder(noticeId: string, now = new Date().toISOString()): Report {
  return {
    noticeId,
    status: "generating",
    noticeLanguage: null,
    buyerPlatform: null,
    facts: null,
    signals: [],
    riskScore: 0,
    summary: null,
    reppo: null,
    audit: [],
    costUsd: 0,
    droppedEvidence: 0,
    error: null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Runs the pipeline for a notice unless a non-failed report already exists.
 * Progress steps are written to the store as they happen; a finished report is queued for Reppo.
 */
export async function startGeneration(
  noticeId: string,
  store: ReportStore,
  deps: PipelineDeps,
  generate: Generate = generateReport,
  onProgress?: (step: string) => void,
): Promise<"started" | "exists"> {
  const existing = await store.get(noticeId);
  if (existing && existing.status !== "failed") return "exists";

  await store.upsert({ ...placeholder(noticeId), progress: "queued" });
  let latest: Report = placeholder(noticeId);
  const report = await generate(noticeId, deps, (step, detail) => {
    onProgress?.(step);
    void store.upsert({ ...latest, progress: step, ...(detail && step === "failed" ? { error: detail } : {}) });
  });
  latest = report;
  await store.upsert({ ...report, progress: report.status === "failed" ? "failed" : "done" });
  if (report.status === "pending_verification") await store.enqueueReppo(noticeId);
  return "started";
}

export interface InternalResponse {
  status: 200 | 401 | 404 | 409;
  body: unknown;
}

/** x402 upstream contract: 200 only for sellable reports, 409 otherwise so the paywall never settles for nothing. */
export async function internalReportResponse(
  store: ReportStore,
  noticeId: string,
  providedSecret: string | null,
  expectedSecret: string,
): Promise<InternalResponse> {
  if (!providedSecret || providedSecret !== expectedSecret) return { status: 401, body: { error: "unauthorized" } };
  const report = await store.get(noticeId);
  if (!report) return { status: 404, body: { error: "report not found" } };
  if (!SELLABLE.has(report.status)) return { status: 409, body: { status: report.status, retryAfterSeconds: RETRY_AFTER_SECONDS } };
  const { progress: _p, ...publicReport } = report;
  return { status: 200, body: publicReport };
}
