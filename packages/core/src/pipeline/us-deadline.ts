// Deadline facts for SAM.gov notices are computed in code from the metadata lines, not by the model: arithmetic on
// dates is where small models slip, and amendments must be measured from the original posting.

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
