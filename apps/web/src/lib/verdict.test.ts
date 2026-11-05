import { describe, expect, it } from "vitest";
import { strongestQuote, verdictWord } from "./verdict";

describe("verdictWord", () => {
  it("maps score bands to one word", () => {
    expect(verdictWord(72)).toBe("Likely.");
    expect(verdictWord(25)).toBe("Possibly.");
    expect(verdictWord(0)).toBe("Unlikely.");
  });
});

describe("strongestQuote", () => {
  it("picks the first quote of the most severe fired signal", () => {
    const q = strongestQuote({
      signals: [
        { id: "S1_SHORT_DEADLINE", fired: true, severity: "medium", reason: "", evidence: ["10 dni"] },
        { id: "S2_BRAND_LOCK", fired: true, severity: "high", reason: "", evidence: ["DarkTrace", "x"] },
        { id: "S3_OVER_SPECIFICATION", fired: false, severity: "none", reason: "", evidence: [] },
      ],
    });
    expect(q).toEqual({ text: "DarkTrace", signalId: "S2_BRAND_LOCK" });
  });
  it("returns null when nothing fired", () => {
    expect(strongestQuote({ signals: [] })).toBeNull();
  });
});
