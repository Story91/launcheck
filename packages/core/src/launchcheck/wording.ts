// Honesty rules for every user-facing LaunchCheck string (spec section 10): no verdicts, no scores, no safety claims.
// copy.test.ts in apps/web and the core tests scan strings with findBannedWords().

export const BANNED_WORDS = [
  "verified",
  "safe",
  "secure",
  "guaranteed",
  "passed",
  "healthy",
  "ready",
  "score",
  "grade",
  "risk",
  "preflight",
  "pre-flight",
] as const;

/** Allowed phrases that contain a banned word (the HTTP term, not a claim about the site). */
export const ALLOWED_PHRASES = ["security headers", "security header"] as const;

/** Default "what we did not check" lines, always shown on a report. */
export const NOT_CHECKED_DEFAULTS = [
  "Rendering speed",
  "Accessibility in a real browser",
  "Real phones and tablets",
  "Security beyond the listed headers",
  "Pages other than the one you entered",
  "Links beyond the first 10",
] as const;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Banned words found in `text` as whole words (case-insensitive), ignoring the allowed phrases. */
export function findBannedWords(text: string): string[] {
  let scrubbed = text.toLowerCase();
  for (const phrase of ALLOWED_PHRASES) scrubbed = scrubbed.split(phrase).join(" ");
  return BANNED_WORDS.filter((w) => new RegExp(`(^|[^a-z-])${escape(w)}($|[^a-z-])`, "i").test(scrubbed));
}
