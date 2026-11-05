import { makeAudit } from "../llm/audit";
import { DISABLE_CONTENT_FILTER, PROMPT_GUARD } from "../llm/markers";
import { parseJsonContent } from "../llm/serv";
import type { ChatRequest, LlmClient } from "../llm/types";
import { EXTRACT_SCHEMA, EXTRACT_V2 } from "../prompts/extract.v2";
import { TenderFacts, type AuditEntry } from "../types";
import { isVerbatim, normalizeForMatch } from "./verify";

export interface ExtractDeps {
  primary: LlmClient;
  fallback: LlmClient;
  primaryModel: string;
  fallbackModel: string;
  /** Use the strict JSON schema (and the SERV prompt guard) on the primary call too; default is loose json_object for Dolphin. */
  primaryJsonSchema?: boolean;
  /** Tells the extractor which equivalence wording and terminology to expect. Defaults to EU. */
  jurisdiction?: "EU" | "US";
}

const JURISDICTION_LABEL = { EU: "EU (Directive 2014/24/EU)", US: "US federal (FAR)" } as const;

export interface ExtractResult {
  facts: TenderFacts;
  audit: AuditEntry[];
}

const VERBATIM_LIST_FIELDS = ["participationConditions", "technicalRequirements", "notes", "brandOrProductNames"] as const;

/**
 * The signal step only ever sees these facts, so anything quotable must really be in the notice.
 * Drops list items and the incumbent name that are not verbatim in the source; returns how many were dropped.
 */
export function sanitizeFacts(facts: TenderFacts, sourceText: string): { facts: TenderFacts; dropped: number } {
  const haystack = normalizeForMatch(sourceText);
  let dropped = 0;
  const out: TenderFacts = { ...facts };
  for (const field of VERBATIM_LIST_FIELDS) {
    const kept = facts[field].filter((item) => {
      const ok = isVerbatim(item, haystack);
      if (!ok) dropped++;
      return ok;
    });
    out[field] = kept;
  }
  if (facts.incumbentSystemMentioned && !isVerbatim(facts.incumbentSystemMentioned, haystack)) {
    out.incumbentSystemMentioned = null;
    dropped++;
  }
  return { facts: out, dropped };
}

function userMessage(text: string, language: string, jurisdiction: "EU" | "US"): string {
  return `noticeLanguage: ${language}\njurisdiction: ${JURISDICTION_LABEL[jurisdiction]}\n\nNOTICE:\n${text}`;
}

async function attempt(
  client: LlmClient,
  step: string,
  req: ChatRequest,
  text: string,
  language: string,
  audit: AuditEntry[],
): Promise<TenderFacts | null> {
  try {
    const res = await client.chat(req);
    try {
      const parsed = parseJsonContent(res, TenderFacts);
      const { facts, dropped } = sanitizeFacts({ ...parsed, noticeLanguage: parsed.noticeLanguage || language }, text);
      audit.push(makeAudit(step, "EXTRACT_V2", req.user, res, dropped > 0 ? `${dropped} non-verbatim extracted item(s) dropped` : undefined));
      return facts;
    } catch (e) {
      audit.push(makeAudit(step, "EXTRACT_V2", req.user, res, (e as Error).message));
      return null;
    }
  } catch (e) {
    audit.push({
      step,
      model: req.model,
      promptVersion: "EXTRACT_V2",
      requestId: null,
      inputHash: "",
      usage: { promptTokens: 0, completionTokens: 0 },
      costUsd: null,
      durationMs: 0,
      note: (e as Error).message,
    });
    return null;
  }
}

/** Extracts TenderFacts; primary first (Dolphin loose JSON, or SERV strict + prompt guard), then SERV strict fallback. */
export async function extractFacts(text: string, language: string, deps: ExtractDeps): Promise<ExtractResult> {
  const audit: AuditEntry[] = [];
  const user = userMessage(text, language, deps.jurisdiction ?? "EU");

  const primaryFacts = await attempt(
    deps.primary,
    "extract.primary",
    deps.primaryJsonSchema
      ? { model: deps.primaryModel, system: EXTRACT_V2, user, jsonSchema: { name: "tender_facts", schema: EXTRACT_SCHEMA }, tools: [PROMPT_GUARD, DISABLE_CONTENT_FILTER] }
      : { model: deps.primaryModel, system: EXTRACT_V2, user, jsonObject: true, temperature: 0 },
    text,
    language,
    audit,
  );
  if (primaryFacts) return { facts: primaryFacts, audit };

  let fallbackError: Error | null = null;
  const fallbackFacts = await attempt(
    {
      chat: async (req) => {
        try {
          return await deps.fallback.chat(req);
        } catch (e) {
          fallbackError = e as Error;
          throw e;
        }
      },
    },
    "extract.fallback",
    {
      model: deps.fallbackModel,
      system: EXTRACT_V2,
      user,
      jsonSchema: { name: "tender_facts", schema: EXTRACT_SCHEMA },
      tools: [DISABLE_CONTENT_FILTER],
    },
    text,
    language,
    audit,
  );
  if (fallbackFacts) return { facts: fallbackFacts, audit };
  throw fallbackError ?? new Error(audit[audit.length - 1]?.note ?? "extraction failed");
}
