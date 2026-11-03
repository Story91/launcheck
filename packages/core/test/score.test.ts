import { describe, expect, it } from "vitest";
import { scoreSignals } from "../src/pipeline/score";
import type { Severity, Signal } from "../src/types";

const s = (severity: Severity, fired = severity !== "none"): Signal => ({
  id: "S1_SHORT_DEADLINE",
  fired,
  severity,
  reason: "",
  evidence: [],
});

describe("scoreSignals", () => {
  it("sums high 25, medium 12, low 5 and ignores none", () => {
    expect(scoreSignals([s("high"), s("medium"), s("low"), s("none")])).toBe(42);
  });
  it("caps at 100", () => {
    expect(scoreSignals([s("high"), s("high"), s("high"), s("high"), s("high")])).toBe(100);
  });
  it("ignores signals that are not fired even if severity is set", () => {
    expect(scoreSignals([s("high", false)])).toBe(0);
  });
  it("is 0 for an empty list", () => {
    expect(scoreSignals([])).toBe(0);
  });
});
