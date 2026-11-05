// Scoring for the GAO-based evaluation set: majority vote over repeated runs, then per-signal precision/recall.

export interface EvalCaseResult {
  id: string;
  group: "positive" | "negative";
  /** Signal ids the case is labelled to fire (empty for a clean negative). */
  expected: string[];
  /** Fired signal ids per run; null marks a run that failed. */
  runs: (string[] | null)[];
}

export interface CaseScore {
  id: string;
  group: "positive" | "negative";
  expected: string[];
  predicted: string[];
  truePositives: string[];
  falsePositives: string[];
  falseNegatives: string[];
  /** Share of completed runs whose fired set equals the most common fired set. */
  stability: number;
  completedRuns: number;
}

export interface EvalMetrics {
  cases: CaseScore[];
  tp: number;
  fp: number;
  fn: number;
  precision: number | null;
  recall: number | null;
  /** Positive cases where at least one expected signal was predicted. */
  positivesCaught: number;
  positives: number;
  /** Negative cases where any unexpected signal was predicted. */
  negativesFlagged: number;
  negatives: number;
  stability: number;
  failedRuns: number;
}

const key = (ids: string[]) => [...new Set(ids)].sort().join(",");

/** Signals fired in at least half of the completed runs. */
export function majoritySet(runs: string[][]): string[] {
  if (runs.length === 0) return [];
  const counts = new Map<string, number>();
  for (const run of runs) for (const id of new Set(run)) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts].filter(([, n]) => n * 2 >= runs.length).map(([id]) => id).sort();
}

function modalShare(runs: string[][]): number {
  if (runs.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const run of runs) counts.set(key(run), (counts.get(key(run)) ?? 0) + 1);
  return Math.max(...counts.values()) / runs.length;
}

export function scoreEval(results: EvalCaseResult[]): EvalMetrics {
  let failedRuns = 0;
  const cases = results.map((c): CaseScore => {
    const done = c.runs.filter((r): r is string[] => r !== null);
    failedRuns += c.runs.length - done.length;
    const predicted = majoritySet(done);
    const expected = [...new Set(c.expected)].sort();
    return {
      id: c.id,
      group: c.group,
      expected,
      predicted,
      truePositives: predicted.filter((s) => expected.includes(s)),
      falsePositives: predicted.filter((s) => !expected.includes(s)),
      falseNegatives: expected.filter((s) => !predicted.includes(s)),
      stability: modalShare(done),
      completedRuns: done.length,
    };
  });
  const sum = (f: (c: CaseScore) => number) => cases.reduce((n, c) => n + f(c), 0);
  const tp = sum((c) => c.truePositives.length);
  const fp = sum((c) => c.falsePositives.length);
  const fn = sum((c) => c.falseNegatives.length);
  const positives = cases.filter((c) => c.group === "positive");
  const negatives = cases.filter((c) => c.group === "negative");
  return {
    cases,
    tp,
    fp,
    fn,
    precision: tp + fp === 0 ? null : tp / (tp + fp),
    recall: tp + fn === 0 ? null : tp / (tp + fn),
    positivesCaught: positives.filter((c) => c.truePositives.length > 0).length,
    positives: positives.length,
    negativesFlagged: negatives.filter((c) => c.falsePositives.length > 0).length,
    negatives: negatives.length,
    stability: cases.length === 0 ? 0 : sum((c) => c.stability) / cases.length,
    failedRuns,
  };
}
