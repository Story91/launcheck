import { z } from "zod";
import { makeAudit } from "../llm/audit";
import { DISABLE_CONTENT_FILTER, shadowAgent } from "../llm/markers";
import { parseJsonContent } from "../llm/serv";
import type { ChatResult, LlmClient } from "../llm/types";
import { SIGNALS_A_V1 } from "../prompts/signals-a.v1";
import { SIGNALS_B_V1 } from "../prompts/signals-b.v1";
import { SIGNALS_C_V1 } from "../prompts/signals-c.v1";
import { SIGNALS_SHADOW_HINT, signalsSchema } from "../prompts/signals-shared";
import { SIGNAL_IDS, Signal, type AuditEntry, type SignalId, type TenderFacts } from "../types";

export const SIGNAL_GROUPS = {
  A: ["S1_SHORT_DEADLINE", "S5_PRICE_WEIGHT_LOW", "S7_NO_LOTS_LARGE_SCOPE"],
  B: ["S2_BRAND_LOCK", "S3_OVER_SPECIFICATION", "S4_EXPERIENCE_LOCK"],
  C: ["S6_DISPROPORTIONATE_CONDITIONS", "S8_UNUSUAL_NOTES"],
} as const satisfies Record<string, readonly SignalId[]>;

export type GroupKey = keyof typeof SIGNAL_GROUPS;

const GROUP_PROMPTS: Record<GroupKey, { version: string; system: string }> = {
  A: { version: "SIGNALS_A_V1", system: SIGNALS_A_V1 },
  B: { version: "SIGNALS_B_V1", system: SIGNALS_B_V1 },
  C: { version: "SIGNALS_C_V1", system: SIGNALS_C_V1 },
};

export interface SignalsDeps {
  serv: LlmClient;
  model: string;
  fallbackModel: string;
}

export interface SignalsResult {
  signals: Signal[];
  audit: AuditEntry[];
}

export const UNAVAILABLE_REASON = "evaluation unavailable";

/** All signals unfired with identical placeholder reasons = the model gave up (seen on gpt-6-luna with long prompts). */
export function isDegenerate(signals: Signal[]): boolean {
  if (signals.length === 0) return true;
  if (signals.some((s) => s.fired)) return false;
  return new Set(signals.map((s) => s.reason.trim())).size === 1;
}

function groupResponseSchema(ids: readonly SignalId[]) {
  return z.object({
    signals: z
      .array(Signal)
      .refine((arr) => arr.length === ids.length && ids.every((id) => arr.some((s) => s.id === id)), {
        message: "group must contain exactly its signal ids",
      }),
  });
}

function unavailable(ids: readonly SignalId[]): Signal[] {
  return ids.map((id) => ({ id, fired: false, severity: "none", reason: UNAVAILABLE_REASON, evidence: [] }));
}

async function runGroup(group: GroupKey, facts: TenderFacts, deps: SignalsDeps): Promise<{ signals: Signal[]; audit: AuditEntry[] }> {
  const ids = SIGNAL_GROUPS[group];
  const { version, system } = GROUP_PROMPTS[group];
  const user = JSON.stringify(facts);
  const schema = groupResponseSchema(ids);
  const audit: AuditEntry[] = [];

  for (const model of [deps.model, deps.fallbackModel]) {
    const fullModel = `${model}-serv-multipath`;
    let res: ChatResult | null = null;
    try {
      res = await deps.serv.chat({
        model: fullModel,
        system,
        user,
        jsonSchema: { name: `signals_${group}`, schema: signalsSchema(ids) },
        tools: [DISABLE_CONTENT_FILTER, shadowAgent(SIGNALS_SHADOW_HINT, 2)],
      });
      const parsed = parseJsonContent(res, schema);
      const ordered = ids.map((id) => parsed.signals.find((s) => s.id === id)!);
      if (isDegenerate(ordered)) {
        audit.push(makeAudit(`signals.${group}`, version, user, res, "degenerate output, retrying"));
        continue;
      }
      audit.push(makeAudit(`signals.${group}`, version, user, res));
      return { signals: ordered, audit };
    } catch (e) {
      const note = (e as Error).message;
      audit.push(
        res
          ? makeAudit(`signals.${group}`, version, user, res, note)
          : { step: `signals.${group}`, model: fullModel, promptVersion: version, requestId: null, inputHash: "", usage: { promptTokens: 0, completionTokens: 0 }, costUsd: null, durationMs: 0, note },
      );
    }
  }
  const last = audit[audit.length - 1];
  if (last) last.note = `group failed: ${last.note ?? "unknown"}`;
  return { signals: unavailable(ids), audit };
}

/** Runs the three signal groups in parallel and returns the eight signals in canonical order. */
export async function evaluateSignals(facts: TenderFacts, deps: SignalsDeps): Promise<SignalsResult> {
  const results = await Promise.all((Object.keys(SIGNAL_GROUPS) as GroupKey[]).map((g) => runGroup(g, facts, deps)));
  const byId = new Map<SignalId, Signal>();
  for (const r of results) for (const s of r.signals) byId.set(s.id, s);
  return {
    signals: SIGNAL_IDS.map((id) => byId.get(id)!),
    audit: results.flatMap((r) => r.audit),
  };
}
