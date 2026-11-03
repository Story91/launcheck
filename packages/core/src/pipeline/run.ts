import { DOLPHIN_DEFAULT_MODEL } from "../llm/dolphin";
import type { LlmClient } from "../llm/types";
import { fetchNoticeXml, isValidNoticeId } from "../ted/client";
import { flattenEforms } from "../ted/flatten";
import type { AuditEntry, Report } from "../types";
import { extractFacts } from "./extract";
import { scoreSignals } from "./score";
import { UNAVAILABLE_REASON, evaluateSignals } from "./signals";
import { summarize } from "./summary";
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

/** Full pipeline: TED → facts → signals → verbatim check → score → summary. Never throws; failures become status "failed". */
export async function generateReport(noticeId: string, deps: PipelineDeps, onProgress: ProgressCallback = () => {}): Promise<Report> {
  const now = deps.now ?? (() => new Date());
  const report = emptyReport(noticeId, now().toISOString());
  const fail = (message: string): Report => {
    onProgress("failed", message);
    return { ...report, status: "failed", error: message, costUsd: sumCost(report.audit), updatedAt: now().toISOString() };
  };

  if (!isValidNoticeId(noticeId)) return fail(`"${noticeId}" is not a valid TED publication number (expected e.g. 722731-2026)`);

  try {
    onProgress("ingest");
    const xml = await fetchNoticeXml(noticeId, deps.fetchImpl ?? fetch);
    const flat = flattenEforms(xml);
    report.noticeLanguage = flat.language;
    report.buyerPlatform = flat.buyerPlatform;

    onProgress("extract");
    const extractModel = deps.extractModel ?? DEFAULT_EXTRACT_MODEL;
    const extracted = await extractFacts(flat.text, flat.language, {
      primary: deps.dolphin ?? deps.serv,
      fallback: deps.serv,
      primaryModel: deps.dolphin ? (deps.dolphinModel ?? DOLPHIN_DEFAULT_MODEL) : extractModel,
      fallbackModel: extractModel,
      primaryJsonSchema: deps.dolphin === null,
    });
    report.facts = extracted.facts;
    report.audit.push(...extracted.audit);

    onProgress("signals");
    const evaluated = await evaluateSignals(extracted.facts, { serv: deps.serv, model: deps.servModel, fallbackModel: deps.fallbackModel });
    report.audit.push(...evaluated.audit);

    const unavailable = evaluated.signals.filter((s) => s.reason === UNAVAILABLE_REASON).length;
    if (unavailable === evaluated.signals.length) throw new Error("signal evaluation unavailable on all groups (model refused or returned degenerate output twice)");
    report.partial = unavailable > 0;

    onProgress("verify");
    const verified = verifyEvidence(evaluated.signals, flat.text);
    report.signals = verified.signals;
    report.droppedEvidence = verified.dropped;
    report.riskScore = scoreSignals(verified.signals);

    onProgress("summary");
    const summarized = await summarize(
      { buyer: extracted.facts.buyer, title: extracted.facts.title, signals: verified.signals },
      { serv: deps.serv, model: deps.servModel },
    );
    report.summary = summarized.summary;
    report.audit.push(summarized.audit);

    onProgress("done");
    return { ...report, status: "pending_verification", costUsd: sumCost(report.audit), updatedAt: now().toISOString() };
  } catch (e) {
    return fail((e as Error).message);
  }
}
