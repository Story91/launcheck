import { DOLPHIN_DEFAULT_MODEL } from "../llm/dolphin";
import type { LlmClient } from "../llm/types";
import { fetchSamNotice } from "../sam/client";
import { fetchNoticeViaApi, flattenApiNotice } from "../ted/api";
import { NoticeNotFoundError, fetchNoticeXml, isSamNoticeId, isValidNoticeId } from "../ted/client";
import { flattenEforms, type FlatNotice } from "../ted/flatten";
import type { AuditEntry, Report } from "../types";
import { extractFacts } from "./extract";
import { scoreSignals } from "./score";
import { UNAVAILABLE_REASON, evaluateSignals, type Jurisdiction } from "./signals";
import { summarize } from "./summary";
import { usDeadlineFacts } from "./us-deadline";
import { verifyEvidence } from "./verify";

export type ProgressStep = "ingest" | "extract" | "signals" | "verify" | "summary" | "done" | "failed";
export type ProgressCallback = (step: ProgressStep, detail?: string) => void;

export interface PipelineDeps {
  serv: LlmClient;
  /** Dolphin client for bulk extraction; null = extract via SERV (gemini-3.1-flash-lite). */
  dolphin: LlmClient | null;
  servModel: string;
  fallbackModel: string;
  /** Model used for SERV-side extraction (fallback or primary when dolphin is null). */
  extractModel?: string;
  dolphinModel?: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  /** SAM.gov public API key; optional fallback for SAM.gov ids that are not in the imported extract. */
  samApiKey?: string;
  /** Notices imported from the public SAM.gov daily extract (no key, no rate limit); consulted first for SAM.gov ids. */
  samNoticeLookup?: (noticeId: string) => Promise<FlatNotice | null>;
}

export const DEFAULT_EXTRACT_MODEL = "gemini-3.1-flash-lite";

function emptyReport(noticeId: string, createdAt: string): Report {
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
    partial: false,
    error: null,
    createdAt,
    updatedAt: createdAt,
  };
}

const sumCost = (audit: AuditEntry[]) => audit.reduce((sum, a) => sum + (a.costUsd ?? 0), 0);

const SIGNAL_LABELS: Record<string, string> = {
  S1_SHORT_DEADLINE: "a short deadline",
  S2_BRAND_LOCK: "a named brand or incumbent system",
  S3_OVER_SPECIFICATION: "over-specified requirements",
  S4_EXPERIENCE_LOCK: "experience tied to one supplier",
  S5_PRICE_WEIGHT_LOW: "a low price weight with subjective criteria",
  S6_DISPROPORTIONATE_CONDITIONS: "disproportionate financial conditions",
  S7_NO_LOTS_LARGE_SCOPE: "no lots across a broad scope",
  S8_UNUSUAL_NOTES: "unusual organisational requirements",
};

/** Deterministic two-sentence summary used when the SERV summary call is unavailable. */
export function templateSummary(buyer: string, signals: Report["signals"]): string {
  const fired = signals.filter((s) => s.fired);
  if (fired.length === 0) return `No competition-restriction signals were detected in the notice text published by ${buyer}. The eight signals were evaluated and none met its threshold.`;
  const list = fired.map((s) => `${SIGNAL_LABELS[s.id] ?? s.id} (${s.severity})`).join(", ");
  return `The notice published by ${buyer} shows ${fired.length} competition-restriction signal${fired.length === 1 ? "" : "s"}: ${list}. Each signal cites a verbatim quote from the notice; see the signal list for details.`;
}

/** Rule set implied by the notice id format: SAM.gov → US federal (FAR), TED → EU. */
export function jurisdictionFor(noticeId: string): Jurisdiction {
  return isSamNoticeId(noticeId) ? "US" : "EU";
}

/**
 * SAM.gov ids go to the SAM.gov Opportunities API. TED ids use the official TED API first (reachable from cloud IPs)
 * and the website XML only as a fallback for notices the API does not return.
 */
async function ingestNotice(noticeId: string, fetchImpl: typeof fetch, deps: PipelineDeps): Promise<FlatNotice> {
  if (isSamNoticeId(noticeId)) {
    const imported = deps.samNoticeLookup ? await deps.samNoticeLookup(noticeId) : null;
    if (imported) return imported;
    if (!deps.samApiKey && deps.samNoticeLookup) {
      throw new NoticeNotFoundError(noticeId, "not in the imported SAM.gov extract (active solicitations from the last 30 days with a description)");
    }
    return fetchSamNotice(noticeId, { apiKey: deps.samApiKey ?? "", fetchImpl, now: deps.now });
  }
  try {
    return flattenApiNotice(await fetchNoticeViaApi(noticeId, fetchImpl));
  } catch (e) {
    if (!(e instanceof NoticeNotFoundError)) throw e;
    return flattenEforms(await fetchNoticeXml(noticeId, fetchImpl));
  }
}

export interface AnalyzeOptions {
  /** false skips the narrative summary (the evaluation set scores signals only). Default true. */
  summary?: boolean;
}

/**
 * Analysis on already-ingested text: facts → signals → verbatim check → score → summary.
 * Shared by generateReport and the GAO evaluation set, so both exercise the same production path. Never throws.
 */
export async function analyzeNotice(
  noticeId: string,
  flat: FlatNotice,
  jurisdiction: Jurisdiction,
  deps: PipelineDeps,
  options: AnalyzeOptions = {},
  onProgress: ProgressCallback = () => {},
  base?: Report,
): Promise<Report> {
  const now = deps.now ?? (() => new Date());
  const report = base ?? emptyReport(noticeId, now().toISOString());
  report.noticeLanguage = flat.language;
  report.buyerPlatform = flat.buyerPlatform;
  const fail = (message: string): Report => {
    onProgress("failed", message);
    return { ...report, status: "failed", error: message, costUsd: sumCost(report.audit), updatedAt: now().toISOString() };
  };

  try {
    onProgress("extract");
    const extractModel = deps.extractModel ?? DEFAULT_EXTRACT_MODEL;
    const extracted = await extractFacts(flat.text, flat.language, {
      primary: deps.dolphin ?? deps.serv,
      fallback: deps.serv,
      primaryModel: deps.dolphin ? (deps.dolphinModel ?? DOLPHIN_DEFAULT_MODEL) : extractModel,
      fallbackModel: extractModel,
      primaryJsonSchema: deps.dolphin === null,
      jurisdiction,
    });
    const computed = jurisdiction === "US" ? usDeadlineFacts(flat.text) : null;
    if (computed) {
      // Dates and notice type come from the SAM.gov metadata lines, computed in code; keep the model's value when a line is absent.
      for (const [k, v] of Object.entries(computed) as [keyof typeof computed, string | number | null][]) {
        if (v !== null) (extracted.facts as Record<string, unknown>)[k] = v;
      }
    }
    report.facts = extracted.facts;
    report.audit.push(...extracted.audit);

    onProgress("signals");
    const evaluated = await evaluateSignals(extracted.facts, { serv: deps.serv, model: deps.servModel, fallbackModel: deps.fallbackModel, jurisdiction });
    report.audit.push(...evaluated.audit);

    const unavailable = evaluated.signals.filter((s) => s.reason === UNAVAILABLE_REASON).length;
    if (unavailable === evaluated.signals.length) throw new Error("signal evaluation unavailable on all groups (model refused or returned degenerate output twice)");
    report.partial = unavailable > 0;

    // A deadline signal is about dates: cite the deadline and posting dates from the notice, not whatever the model picked.
    const deadlineEvidence = [computed?.deadlineForTenders, computed?.publicationDate].filter((x): x is string => !!x);
    const signals = deadlineEvidence.length
      ? evaluated.signals.map((s) => (s.id === "S1_SHORT_DEADLINE" && s.fired ? { ...s, evidence: deadlineEvidence } : s))
      : evaluated.signals;

    onProgress("verify");
    const verified = verifyEvidence(signals, flat.text);
    report.signals = verified.signals;
    report.droppedEvidence = verified.dropped;
    report.riskScore = scoreSignals(verified.signals);

    if (options.summary !== false) {
      onProgress("summary");
      try {
        const summarized = await summarize(
          { buyer: extracted.facts.buyer, title: extracted.facts.title, signals: verified.signals },
          { serv: deps.serv, model: deps.servModel },
        );
        report.summary = summarized.summary;
        report.audit.push(summarized.audit);
      } catch (e) {
        // The signals are the product; a missing narrative must not throw away a paid-for evaluation.
        report.summary = templateSummary(extracted.facts.buyer, verified.signals);
        report.audit.push({ step: "summary", model: deps.servModel, promptVersion: "SUMMARY_V2", requestId: null, inputHash: "", usage: { promptTokens: 0, completionTokens: 0 }, costUsd: null, durationMs: 0, note: `summary unavailable, template used: ${(e as Error).message}` });
      }
    }

    onProgress("done");
    return { ...report, status: "pending_verification", costUsd: sumCost(report.audit), updatedAt: now().toISOString() };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/** Full pipeline: ingest (SAM.gov or TED) → analyzeNotice. Never throws; failures become status "failed". */
export async function generateReport(noticeId: string, deps: PipelineDeps, onProgress: ProgressCallback = () => {}): Promise<Report> {
  const now = deps.now ?? (() => new Date());
  const report = emptyReport(noticeId, now().toISOString());
  const fail = (message: string): Report => {
    onProgress("failed", message);
    return { ...report, status: "failed", error: message, costUsd: sumCost(report.audit), updatedAt: now().toISOString() };
  };

  if (!isValidNoticeId(noticeId)) {
    return fail(`"${noticeId}" is neither a SAM.gov notice id (32 hex characters) nor a TED publication number (e.g. 722731-2026)`);
  }

  let flat: FlatNotice;
  try {
    onProgress("ingest");
    flat = await ingestNotice(noticeId, deps.fetchImpl ?? fetch, deps);
  } catch (e) {
    return fail((e as Error).message);
  }
  return analyzeNotice(noticeId, flat, jurisdictionFor(noticeId), deps, {}, onProgress, report);
}
