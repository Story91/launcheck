// Deadline facts for SAM.gov notices are computed in code from the metadata lines, not by the model: arithmetic on
// dates is where small models slip, and amendments must be measured from the original posting.
import type { Signal } from "../types";

export interface UsDeadlineFacts {
  procedureType: string | null;
  publicationDate: string | null;
  deadlineForTenders: string | null;
  daysToDeadline: number | null;
}

const field = (text: string, name: string): string | null => {
  const m = text.match(new RegExp(`^${name}: (.+)$`, "m"));
  return m?.[1]?.trim() || null;
};

/** "2026-10-20 09:00:00" → "2026-10-20"; null when it does not start with a date. */
const dateOnly = (s: string | null) => s?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null;

export function usDeadlineFacts(text: string): UsDeadlineFacts {
  const start = dateOnly(field(text, "originalPostedDate") ?? field(text, "postedDate"));
  const deadline = field(text, "responseDeadLine");
  let days: number | null = null;
  const deadlineDay = dateOnly(deadline);
  if (start && deadlineDay) {
    const diff = (Date.parse(`${deadlineDay}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000;
    days = Number.isFinite(diff) ? Math.round(diff) : null;
  }
  return { procedureType: field(text, "type"), publicationDate: start, deadlineForTenders: deadline, daysToDeadline: days };
}

const OFFER_TYPES = new Set(["Solicitation", "Combined Synopsis/Solicitation"]);
/** Commercial acquisitions need only a reasonable response time (FAR 12.603, 13.003); FAR 2.101 covers off-the-shelf subscriptions and support. */
const COMMERCIAL = /\b(subscriptions?|licen[cs]es?|renewals?|maintenance|commercial (items?|products?|services?)|simplified acquisition|COTS|FAR (part )?1[23])\b/i;

/**
 * S1 for SAM.gov notices, computed in code from the dates and notice type (the model's S1 is replaced): the rule is
 * arithmetic plus a type check, and small models were inconsistent on it. Null when the dates are unknown.
 */
export function usDeadlineSignal(facts: UsDeadlineFacts, text: string): Signal | null {
  const days = facts.daysToDeadline;
  if (days === null) return null;
  const evidence = [facts.deadlineForTenders, facts.publicationDate].filter((x): x is string => !!x);
  const none = (reason: string): Signal => ({ id: "S1_SHORT_DEADLINE", fired: false, severity: "none", reason, evidence: [] });
  if (!facts.procedureType || !OFFER_TYPES.has(facts.procedureType)) {
    return none(`The notice type (${facts.procedureType ?? "unknown"}) does not ask for offers, so the response-time rule does not apply.`);
  }
  const commercial = facts.procedureType === "Combined Synopsis/Solicitation" || COMMERCIAL.test(text);
  const span = `${days} days from posting (${facts.publicationDate}) to the deadline (${facts.deadlineForTenders})`;
  if (commercial) {
    if (days < 5) return { id: "S1_SHORT_DEADLINE", fired: true, severity: "low", reason: `The notice allows ${span}; for a commercial acquisition FAR 12.603 asks for a reasonable response time, and fewer than 5 days meets this rule.`, evidence };
    return none(`The notice allows ${span}; for a commercial acquisition FAR 12.603 asks only for a reasonable response time.`);
  }
  const severity = days < 10 ? "high" : days < 15 ? "medium" : days < 30 ? "low" : null;
  if (!severity) return none(`The notice allows ${span}, at least the 30 days FAR 5.203(c) expects.`);
  return { id: "S1_SHORT_DEADLINE", fired: true, severity, reason: `The notice allows ${span}; FAR 5.203(c) expects at least 30 days for a non-commercial solicitation.`, evidence };
}
