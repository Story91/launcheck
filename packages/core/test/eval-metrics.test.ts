import { describe, expect, it } from "vitest";
import { majoritySet, scoreEval, type EvalCaseResult } from "../src/eval/metrics";

const r = (id: string, group: "positive" | "negative", expected: string[], runs: string[][]): EvalCaseResult => ({ id, group, expected, runs });

describe("majoritySet", () => {
  it("keeps signals fired in at least half of the runs", () => {
    expect(majoritySet([["S2"], ["S2", "S8"], ["S2"]])).toEqual(["S2"]);
    expect(majoritySet([["S2"], ["S3"]])).toEqual(["S2", "S3"]);
    expect(majoritySet([])).toEqual([]);
  });
});

describe("scoreEval", () => {
  it("computes per-signal precision and recall on majority predictions", () => {
    const m = scoreEval([
      r("a", "positive", ["S2"], [["S2"], ["S2"], ["S2"]]),
      r("b", "positive", ["S3"], [[], [], ["S3"]]),
      r("c", "negative", [], [["S8"], ["S8"], []]),
    ]);
    expect(m.tp).toBe(1);
    expect(m.fp).toBe(1);
    expect(m.fn).toBe(1);
    expect(m.precision).toBeCloseTo(0.5);
    expect(m.recall).toBeCloseTo(0.5);
    expect(m.positivesCaught).toBe(1);
    expect(m.positives).toBe(2);
    expect(m.negativesFlagged).toBe(1);
    expect(m.negatives).toBe(1);
  });

  it("measures stability as the share of runs matching the modal fired set", () => {
    const m = scoreEval([
      r("a", "positive", ["S2"], [["S2"], ["S2"], ["S2", "S8"]]),
      r("b", "negative", [], [[], [], []]),
    ]);
    expect(m.cases.find((c) => c.id === "a")?.stability).toBeCloseTo(2 / 3);
    expect(m.cases.find((c) => c.id === "b")?.stability).toBe(1);
    expect(m.stability).toBeCloseTo((2 / 3 + 1) / 2);
  });

  it("treats a negative as flagged only for signals it was not expected to fire", () => {
    const m = scoreEval([r("n", "negative", ["S5"], [["S5"], ["S5"], ["S5"]])]);
    expect(m.negativesFlagged).toBe(0);
    expect(m.tp).toBe(1);
  });

  it("ignores runs that failed (null) when voting and reports them", () => {
    const m = scoreEval([{ id: "a", group: "positive", expected: ["S2"], runs: [["S2"], null, ["S2"]] }]);
    expect(m.failedRuns).toBe(1);
    expect(m.cases[0]?.predicted).toEqual(["S2"]);
  });

  it("returns null precision when nothing was predicted", () => {
    const m = scoreEval([r("a", "positive", ["S2"], [[], []])]);
    expect(m.precision).toBeNull();
    expect(m.recall).toBe(0);
  });
});
