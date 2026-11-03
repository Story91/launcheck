import type { Report } from "../types";

export const REPPO_PAYLOAD_LIMIT = 40_000;

export const REPPO_CRITERIA = [
  "Every fired signal cites a verbatim quote from the notice",
  "Tone is neutral and descriptive; no accusation of wrongdoing",
  "Severity levels follow the stated rules (high/medium/low)",
] as const;

export const REPPO_CONTEXT =
  "Independent review of a competition-restriction signals report on an EU public tender notice; the audience is bidders and journalists; tone must be neutral. Severity rules: high = named brand/incumbent without equivalence clause or experience tied to the offered product; medium = over-specification, disproportionate financial conditions, low price weight with subjective criteria; low = no lots across a broad scope, unusual organisational requirements, deadline under 30 days.";

export interface ReppoArtifact {
  payload: string;
  context: string;
  criteria: string[];
}

/** English markdown of the report for independent judges; fired signals only; hard-capped at 40 KB. */
export function reportToArtifact(report: Report): ReppoArtifact {
  const lines: string[] = [];
  lines.push(`# Competition-restriction signals report — TED notice ${report.noticeId}`);
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
  return { payload, context: REPPO_CONTEXT, criteria: [...REPPO_CRITERIA] };
}
