import { makeAudit } from "../llm/audit";
import { DISABLE_CONTENT_FILTER } from "../llm/markers";
import { parseJsonContent } from "../llm/serv";
import type { ChatRequest, LlmClient } from "../llm/types";
import { EXTRACT_SCHEMA, EXTRACT_V1 } from "../prompts/extract.v1";
import { TenderFacts, type AuditEntry } from "../types";

export interface ExtractDeps {
  primary: LlmClient;
  fallback: LlmClient;
  primaryModel: string;
  fallbackModel: string;
  /** Use the strict JSON schema on the primary call too (SERV-only mode); default is loose json_object for Dolphin. */
  primaryJsonSchema?: boolean;
}

export interface ExtractResult {
  facts: TenderFacts;
  audit: AuditEntry[];
}

function userMessage(text: string, language: string): string {
  return `noticeLanguage: ${language}\n\nNOTICE:\n${text}`;
}

async function attempt(
  client: LlmClient,
  step: string,
  req: ChatRequest,
  language: string,
  audit: AuditEntry[],
): Promise<TenderFacts | null> {
  try {
    const res = await client.chat(req);
    try {
      const facts = parseJsonContent(res, TenderFacts);
      audit.push(makeAudit(step, "EXTRACT_V1", req.user, res));
      return { ...facts, noticeLanguage: facts.noticeLanguage || language };
    } catch (e) {
      audit.push(makeAudit(step, "EXTRACT_V1", req.user, res, (e as Error).message));
      return null;
    }
  } catch (e) {
    audit.push({
      step,
      model: req.model,
      promptVersion: "EXTRACT_V1",
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

/** Extracts TenderFacts; primary (Dolphin, loose JSON) first, then fallback (SERV, strict schema). */
export async function extractFacts(text: string, language: string, deps: ExtractDeps): Promise<ExtractResult> {
  const audit: AuditEntry[] = [];
  const user = userMessage(text, language);

  const primaryFacts = await attempt(
    deps.primary,
    "extract.primary",
    deps.primaryJsonSchema
      ? { model: deps.primaryModel, system: EXTRACT_V1, user, jsonSchema: { name: "tender_facts", schema: EXTRACT_SCHEMA }, tools: [DISABLE_CONTENT_FILTER] }
      : { model: deps.primaryModel, system: EXTRACT_V1, user, jsonObject: true, temperature: 0 },
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
      system: EXTRACT_V1,
      user,
      jsonSchema: { name: "tender_facts", schema: EXTRACT_SCHEMA },
      tools: [DISABLE_CONTENT_FILTER],
    },
    language,
    audit,
  );
  if (fallbackFacts) return { facts: fallbackFacts, audit };
  throw fallbackError ?? new Error(audit[audit.length - 1]?.note ?? "extraction failed");
}
