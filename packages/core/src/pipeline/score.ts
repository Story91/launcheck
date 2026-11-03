import { SEVERITY_POINTS, type Signal } from "../types";

export const MAX_RISK_SCORE = 100;

/** Risk score = sum of severity points over fired signals, capped at 100. */
export function scoreSignals(signals: Signal[]): number {
  const total = signals.filter((s) => s.fired).reduce((sum, s) => sum + SEVERITY_POINTS[s.severity], 0);
  return Math.min(MAX_RISK_SCORE, total);
}
