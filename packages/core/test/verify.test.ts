import { describe, expect, it } from "vitest";
import { isVerbatim, normalizeForMatch, verifyEvidence } from "../src/pipeline/verify";
import type { Signal } from "../src/types";

const source = `Description: Wykonanie przez Wykonawcę Usług instalacyjno-wdrożeniowych wraz z integracją z Systemem "DarkTrace" oraz przygotowaniem dokumentacji.
ItemClassificationCode: 48000000
Note: Warunkiem przystąpienia do postępowania i złożenia oferty jest posiadanie konta na platformie MarketPlanet.`;

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
    const { signals, dropped } = verifyEvidence([sig(["„integracją z Systemem “DarkTrace” oraz przygotowaniem.”"])], source);
    expect(dropped).toBe(0);
    expect(signals[0]?.fired).toBe(true);
    expect(signals[0]?.evidence).toHaveLength(1);
  });

  it("drops a paraphrase and unfires the signal", () => {
    const { signals, dropped } = verifyEvidence([sig(["Wymóg integracji z DarkTrace"])], source);
    expect(dropped).toBe(1);
    expect(signals[0]).toMatchObject({ fired: false, severity: "none", evidence: [] });
    expect(signals[0]?.reason).toContain("dropped: no verbatim evidence");
  });

  it("drops quotes shorter than 12 characters such as JSON keys", () => {
    const { signals, dropped } = verifyEvidence([sig(["lots:null", "posiadanie konta na platformie MarketPlanet"])], source);
    expect(dropped).toBe(1);
    expect(signals[0]?.evidence).toEqual(["posiadanie konta na platformie MarketPlanet"]);
    expect(signals[0]?.fired).toBe(true);
  });

  it("accepts a short code (4-11 chars) only when it appears as a whole token in the source", () => {
    const { signals, dropped } = verifyEvidence([sig(["48000000", "72250000"], { id: "S7_NO_LOTS_LARGE_SCOPE", severity: "low" })], source);
    expect(dropped).toBe(1);
    expect(signals[0]?.evidence).toEqual(["48000000"]);
    expect(signals[0]?.fired).toBe(true);
  });

  it("drops text that exists only in the model-extracted facts, never in the notice", () => {
    const { signals, dropped } = verifyEvidence([sig(['"equivalenceClausePresent":false', "Integracja z Systemem DarkTrace"])], source);
    expect(dropped).toBe(2);
    expect(signals[0]?.fired).toBe(false);
  });

  it("leaves unfired signals untouched and keeps order", () => {
    const unfired = sig([], { id: "S1_SHORT_DEADLINE", fired: false, severity: "none" });
    const { signals } = verifyEvidence([unfired, sig(["posiadanie konta na platformie MarketPlanet"])], source);
    expect(signals.map((s) => s.id)).toEqual(["S1_SHORT_DEADLINE", "S2_BRAND_LOCK"]);
    expect(signals[0]).toEqual(unfired);
  });
});

describe("isVerbatim short brand acronyms", () => {
  const src = normalizeForMatch("** THIS IS A BRAND NAME REQUIREMENT ** for Requirement: HID ID/Access Cards; IBM storage");
  it("accepts 2–3 character upper-case names that appear as whole tokens", () => {
    expect(isVerbatim("HID", src)).toBe(true);
    expect(isVerbatim("IBM", src)).toBe(true);
  });
  it("still rejects short lower-case fragments and acronyms that are only part of a word", () => {
    expect(isVerbatim("for", src)).toBe(false);
    expect(isVerbatim("HI", src)).toBe(false);
    expect(isVerbatim("SAP", src)).toBe(false);
  });
});
