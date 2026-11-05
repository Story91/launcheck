import type { Report } from "@tendr/core";

/** One-word answer to "is this tender written for someone else?", derived from the risk score. */
export function verdictWord(score: number): "Likely." | "Possibly." | "Unlikely." {
  if (score >= 50) return "Likely.";
  if (score >= 25) return "Possibly.";
  return "Unlikely.";
}

export function isReady(r: Pick<Report, "status">): boolean {
  return r.status !== "generating" && r.status !== "failed" && r.status !== "withheld";
}

const RANK = { high: 3, medium: 2, low: 1, none: 0 } as const;

/** The strongest verbatim quote in a report, for the hero panel. */
export function strongestQuote(r: Pick<Report, "signals">): { text: string; signalId: string } | null {
  const best = r.signals.filter((s) => s.fired && s.evidence.length > 0).sort((a, b) => RANK[b.severity] - RANK[a.severity])[0];
  return best ? { text: best.evidence[0], signalId: best.id } : null;
}
