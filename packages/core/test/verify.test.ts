import { describe, expect, it } from "vitest";
import { normalizeForMatch, verifyEvidence } from "../src/pipeline/verify";
import type { Signal } from "../src/types";

const source = `Description: Wykonanie przez Wykonawcę Usług instalacyjno-wdrożeniowych wraz z integracją z Systemem "DarkTrace" oraz przygotowaniem dokumentacji.
Note: Warunkiem przystąpienia do postępowania i złożenia oferty jest posiadanie konta na platformie MarketPlanet.`;
const factsJson = JSON.stringify({ lots: null, brandOrProductNames: ["DarkTrace"] });

const sig = (evidence: string[], over: Partial<Signal> = {}): Signal => ({
  id: "S2_BRAND_LOCK",
  fired: true,
  severity: "high",
  reason: "named incumbent",
  evidence,
  ...over,
});

describe("normalizeForMatch", () => {
  it("maps typographic quotes, NBSP and whitespace runs to a canonical form", () => {
    expect(normalizeForMatch("„Integracja z  Systemem ‘X’.”")).toBe('"integracja z systemem \'x\'"');
  });
});

describe("verifyEvidence", () => {
  it("accepts a quote with curly quotes and odd whitespace", () => {
    const { signals, dropped } = verifyEvidence([sig(["„integracją z Systemem “DarkTrace” oraz przygotowaniem.”"])], source, factsJson);
    expect(dropped).toBe(0);
    expect(signals[0]?.fired).toBe(true);
    expect(signals[0]?.evidence).toHaveLength(1);
  });

  it("drops a paraphrase and unfires the signal", () => {
    const { signals, dropped } = verifyEvidence([sig(["Wymóg integracji z DarkTrace"])], source, factsJson);
    expect(dropped).toBe(1);
    expect(signals[0]).toMatchObject({ fired: false, severity: "none", evidence: [] });
    expect(signals[0]?.reason).toContain("dropped: no verbatim evidence");
  });

  it("drops quotes shorter than 12 characters such as JSON keys", () => {
    const { signals, dropped } = verifyEvidence([sig(["lots:null", "posiadanie konta na platformie MarketPlanet"])], source, factsJson);
    expect(dropped).toBe(1);
    expect(signals[0]?.evidence).toEqual(["posiadanie konta na platformie MarketPlanet"]);
    expect(signals[0]?.fired).toBe(true);
  });

  it("accepts a short quote when it is an exact string value in the facts (e.g. a CPV code)", () => {
    const { signals, dropped } = verifyEvidence([sig(["48000000"], { id: "S7_NO_LOTS_LARGE_SCOPE", severity: "low" })], source, JSON.stringify({ cpv: ["48000000", "72250000"] }));
    expect(dropped).toBe(0);
    expect(signals[0]?.fired).toBe(true);
  });

  it("accepts quotes that exist only in the extracted facts", () => {
    const { dropped } = verifyEvidence([sig(['"brandOrProductNames":["DarkTrace"]'])], source, factsJson);
    expect(dropped).toBe(0);
  });

  it("leaves unfired signals untouched and keeps order", () => {
    const unfired = sig([], { id: "S1_SHORT_DEADLINE", fired: false, severity: "none" });
    const { signals } = verifyEvidence([unfired, sig(["posiadanie konta na platformie MarketPlanet"])], source, factsJson);
    expect(signals.map((s) => s.id)).toEqual(["S1_SHORT_DEADLINE", "S2_BRAND_LOCK"]);
    expect(signals[0]).toEqual(unfired);
  });
});
