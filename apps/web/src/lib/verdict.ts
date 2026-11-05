import type { Report } from "@tendr/core";

/** One-word answer to "is this tender written for someone else?", derived from the risk score. */
export function verdictWord(score: number): "Likely." | "Possibly." | "Unlikely." {
  if (score >= 50) return "Likely.";
  if (score >= 25) return "Possibly.";
  return "Unlikely.";
}

/** Background of the answer panel: red only when the answer is "Likely." */
export function verdictTone(score: number): "bg-seal" | "bg-amber" | "bg-moss" {
  if (score >= 50) return "bg-seal";
  if (score >= 25) return "bg-amber";
  return "bg-moss";
}

export function isReady(r: Pick<Report, "status">): boolean {
  return r.status !== "generating" && r.status !== "failed" && r.status !== "withheld";
}

const RANK = { high: 3, medium: 2, low: 1, none: 0 } as const;

/**
 * The strongest verbatim quote in a report, for the hero panel: any quote from the notice text before deadline dates
 * (S1 evidence is just dates), then the most severe signal, then the longest quote of that signal.
 */
export function strongestQuote(r: Pick<Report, "signals">): { text: string; signalId: string } | null {
  const score = (s: Report["signals"][number]) => (s.id === "S1_SHORT_DEADLINE" ? 0 : 10) + RANK[s.severity];
  const best = r.signals.filter((s) => s.fired && s.evidence.length > 0).sort((a, b) => score(b) - score(a))[0];
  if (!best) return null;
  const text = [...best.evidence].sort((a, b) => b.length - a.length)[0]!;
  return { text, signalId: best.id };
}
