import type { Signal } from "../types";

const MIN_EVIDENCE_LENGTH = 12;

/** Canonical form for substring matching: NFC, straight quotes, single spaces, no trailing punctuation, lowercase. */
export function normalizeForMatch(s: string): string {
  return s
    .normalize("NFC")
    .replace(/[„“”«»]/g, '"')
    .replace(/[‘’‚‹›]/g, "'")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.;,:]+("?)$/, "$1")
    .toLowerCase();
}

export interface VerifyResult {
  signals: Signal[];
  dropped: number;
}

/** Keeps only evidence that is a verbatim substring of the source (notice text + extracted facts); unfires signals left without evidence. */
export function verifyEvidence(signals: Signal[], sourceText: string, factsJson: string): VerifyResult {
  const haystack = normalizeForMatch(`${sourceText}\n${factsJson}`);
  const factsNormalized = normalizeForMatch(factsJson);
  let dropped = 0;
  const verified = signals.map((signal) => {
    if (!signal.fired) return signal;
    const kept = signal.evidence.filter((e) => {
      const needle = normalizeForMatch(e).replace(/^"|"$/g, "");
      // Short quotes are accepted only when they are a whole string value in the facts (codes, short names), never JSON keys.
      const longEnough = needle.length >= MIN_EVIDENCE_LENGTH || (needle.length >= 4 && factsNormalized.includes(`"${needle}"`));
      const ok = longEnough && haystack.includes(needle);
      if (!ok) dropped++;
      return ok;
    });
    if (kept.length > 0) return { ...signal, evidence: kept };
    return {
      ...signal,
      fired: false,
      severity: "none" as const,
      evidence: [],
      reason: `${signal.reason} (dropped: no verbatim evidence)`,
    };
  });
  return { signals: verified, dropped };
}
