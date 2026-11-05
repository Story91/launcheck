import { isSamNoticeId } from "../ted/client";
import type { Report } from "../types";

export const REPPO_PAYLOAD_LIMIT = 40_000;

export const REPPO_CRITERIA = [
  "Every fired signal cites a verbatim quote from the notice",
  "Tone is neutral and descriptive; no accusation of wrongdoing",
  "Severity levels follow the stated rules (high/medium/low)",
] as const;

/** EU (TED) review context. */
export const REPPO_CONTEXT =
  "Independent review of a competition-restriction signals report on an EU public tender notice; the audience is bidders and journalists; tone must be neutral. Severity rules: high = named brand/incumbent without equivalence clause or experience tied to the offered product; medium = over-specification, disproportionate financial conditions, low price weight with subjective criteria; low = no lots across a broad scope, unusual organisational requirements, deadline under 30 days.";

/** US federal (SAM.gov, FAR) review context. */
export const REPPO_CONTEXT_US =
  "Independent review of a competition-restriction signals report on a US federal contract opportunity published on SAM.gov (FAR); the audience is bidders and journalists; tone must be neutral. Small-business set-asides are lawful policy and must not be treated as restrictions. Severity rules: high = brand name only or named incumbent system without 'or equal' (FAR 11.104), or past performance tied to this agency or the exact product; medium = over-specification (FAR 11.002), disproportionate bonding/revenue/clearance conditions, price significantly less important than subjective factors; low = bundled distinct requirements in one award (FAR 7.107), unusual response conditions, response time under 30 days (FAR 5.203).";

export interface ReppoArtifact {
  payload: string;
  context: string;
  criteria: string[];
}

/** English markdown of the report for independent judges; fired signals only; hard-capped at 40 KB. */
export function reportToArtifact(report: Report): ReppoArtifact {
  const us = isSamNoticeId(report.noticeId);
  const lines: string[] = [];
  lines.push(`# Competition-restriction signals report — ${us ? "SAM.gov" : "TED"} notice ${report.noticeId}`);
  lines.push("");
  lines.push(`Buyer: ${report.facts?.buyer ?? "unknown"}`);
  lines.push(`Title: ${report.facts?.title ?? "unknown"}`);
  lines.push(`Estimated value: ${report.facts?.estimatedValue ?? "n/a"} ${report.facts?.currency ?? ""}`.trim());
  lines.push(`Risk score: ${report.riskScore}/100`);
  lines.push("");
  lines.push(`Summary: ${report.summary ?? ""}`);
  lines.push("");
  lines.push("## Fired signals");
  const fired = report.signals.filter((s) => s.fired);
  if (fired.length === 0) lines.push("(none)");
  for (const s of fired) {
    lines.push(`### ${s.id} — ${s.severity}`);
    lines.push(s.reason);
    for (const e of s.evidence) lines.push(`> ${e}`);
    lines.push("");
  }
  let payload = lines.join("\n");
  if (payload.length > REPPO_PAYLOAD_LIMIT) payload = `${payload.slice(0, REPPO_PAYLOAD_LIMIT - 16)}\n…(truncated)`;
  return { payload, context: us ? REPPO_CONTEXT_US : REPPO_CONTEXT, criteria: [...REPPO_CRITERIA] };
}
