import { describe, expect, it } from "vitest";
import { SEVERITY_POINTS, Signal, TenderFacts } from "../src/types";
import facts from "./fixtures/722731-2026.facts.json";

describe("core types", () => {
  it("parses the recorded facts fixture", () => {
    const parsed = TenderFacts.parse({ ...facts, noticeLanguage: "POL" });
    expect(parsed.buyer).toBe("Narodowy Bank Polski");
  });

  it("rejects a signal with unknown id", () => {
    expect(() =>
      Signal.parse({ id: "S9", fired: false, severity: "none", reason: "", evidence: [] }),
    ).toThrow();
  });

  it("severity points match the spec", () => {
    expect(SEVERITY_POINTS).toEqual({ none: 0, low: 5, medium: 12, high: 25 });
  });
});
