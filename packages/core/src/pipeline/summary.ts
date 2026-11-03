import { z } from "zod";
import { makeAudit } from "../llm/audit";
import { DISABLE_CONTENT_FILTER } from "../llm/markers";
import { parseJsonContent } from "../llm/serv";
import type { LlmClient } from "../llm/types";
import { SUMMARY_SCHEMA, SUMMARY_V1 } from "../prompts/summary.v1";
import type { AuditEntry, Signal } from "../types";

export interface SummaryInput {
  buyer: string;
  title: string;
  signals: Signal[];
}

export async function summarize(
  input: SummaryInput,
  deps: { serv: LlmClient; model: string },
): Promise<{ summary: string; audit: AuditEntry }> {
  const user = JSON.stringify({
    buyer: input.buyer,
    title: input.title,
    firedSignals: input.signals.filter((s) => s.fired).map((s) => ({ id: s.id, severity: s.severity, reason: s.reason })),
  });
  const res = await deps.serv.chat({
    model: deps.model,
    system: SUMMARY_V1,
    user,
    jsonSchema: { name: "summary", schema: SUMMARY_SCHEMA },
    tools: [DISABLE_CONTENT_FILTER],
  });
  const { summary } = parseJsonContent(res, z.object({ summary: z.string() }));
  return { summary, audit: makeAudit("summary", "SUMMARY_V1", user, res) };
}
