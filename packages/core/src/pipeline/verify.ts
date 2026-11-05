import type { Signal } from "../types";

const MIN_EVIDENCE_LENGTH = 12;
const MIN_CODE_LENGTH = 4;

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

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * True when `candidate` appears verbatim in the normalized source. Quotes of 12+ characters match as substrings;
 * shorter ones (codes, short names, 4–11 chars, or 2–3-character upper-case acronyms) must appear as a whole token so
 * JSON keys and fragments never pass.
 */
export function isVerbatim(candidate: string, normalizedSource: string): boolean {
  const needle = normalizeForMatch(candidate).replace(/^"|"$/g, "");
  if (needle.length >= MIN_EVIDENCE_LENGTH) return normalizedSource.includes(needle);
  // 2–3 characters only for upper-case acronyms (brand names such as HID, IBM, HP), never for ordinary short words.
  const acronym = /^[\p{Lu}\p{N}&]{2,3}$/u.test(candidate.trim());
  if (needle.length < MIN_CODE_LENGTH && !(acronym && needle.length >= 2)) return false;
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(needle)}($|[^\\p{L}\\p{N}])`, "u").test(normalizedSource);
}

export interface VerifyResult {
  signals: Signal[];
  dropped: number;
}

/** Keeps only evidence that is verbatim in the NOTICE TEXT (never in model output); unfires signals left without evidence. */
export function verifyEvidence(signals: Signal[], sourceText: string): VerifyResult {
  const haystack = normalizeForMatch(sourceText);
  let dropped = 0;
  const verified = signals.map((signal) => {
    if (!signal.fired) return signal;
    const kept = signal.evidence.filter((e) => {
      const ok = isVerbatim(e, haystack);
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
