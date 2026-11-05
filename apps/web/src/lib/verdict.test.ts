import { describe, expect, it } from "vitest";
import { strongestQuote, verdictTone, verdictWord } from "./verdict";

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
  it("prefers a quote from the notice text over deadline dates, and the longest quote of that signal", () => {
    const q = strongestQuote({
      signals: [
        { id: "S1_SHORT_DEADLINE", fired: true, severity: "high", reason: "", evidence: ["2026-11-04"] },
        { id: "S2_BRAND_LOCK", fired: true, severity: "high", reason: "", evidence: ["JFrog Artifactory", "Offeror must be an Authorized Reseller/Partner of JFrog"] },
      ],
    });
    expect(q).toEqual({ text: "Offeror must be an Authorized Reseller/Partner of JFrog", signalId: "S2_BRAND_LOCK" });
  });
  it("still shows the deadline when it is the only fired signal", () => {
    const q = strongestQuote({ signals: [{ id: "S1_SHORT_DEADLINE", fired: true, severity: "high", reason: "", evidence: ["2026-11-04"] }] });
    expect(q?.signalId).toBe("S1_SHORT_DEADLINE");
  });
  it("returns null when nothing fired", () => {
    expect(strongestQuote({ signals: [] })).toBeNull();
  });
});

describe("verdictTone", () => {
  it("colours the answer panel by verdict, not always red", () => {
    expect(verdictTone(60)).toBe("bg-seal");
    expect(verdictTone(30)).toBe("bg-amber");
    expect(verdictTone(0)).toBe("bg-moss");
  });
});
