const TED_SEARCH_URL = "https://api.ted.europa.eu/v3/notices/search";
const USER_AGENT = "TenderHound/0.1";
const TED_TIMEOUT_MS = 30_000;

export class NoticeNotFoundError extends Error {
  constructor(public readonly noticeId: string) {
    super(`Notice ${noticeId} was not found on TED`);
    this.name = "NoticeNotFoundError";
  }
}

export interface NoticeSummary {
  noticeId: string;
  title: string;
  buyer: string;
  deadline: string | null;
}

export function isValidNoticeId(id: string): boolean {
  return /^\d{1,6}-\d{4}$/.test(id);
}

export function defaultSearchQuery(now: Date = new Date()): string {
  const from = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
  const ymd = from.toISOString().slice(0, 10).replace(/-/g, "");
  return `place-of-performance=POL AND classification-cpv=72* AND publication-date>=${ymd}`;
}

type LangMap = Record<string, string | string[]> | undefined;

function pickLang(map: LangMap, preferred = ["pol", "eng"]): string {
  if (!map) return "";
  for (const key of preferred) {
    const v = map[key];
    if (v) return Array.isArray(v) ? (v[0] ?? "") : v;
  }
  const first = Object.values(map)[0];
  return Array.isArray(first) ? (first[0] ?? "") : (first ?? "");
}

export async function searchNotices(
  query: string,
  opts: { limit?: number; fetchImpl?: typeof fetch } = {},
): Promise<NoticeSummary[]> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const res = await fetchImpl(TED_SEARCH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
    body: JSON.stringify({
      query,
      fields: ["publication-number", "notice-title", "buyer-name", "deadline-receipt-tender-date-lot"],
      limit: opts.limit ?? 10,
      page: 1,
    }),
    signal: AbortSignal.timeout(TED_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`TED search failed: HTTP ${res.status}`);
  const json = (await res.json()) as { notices?: Record<string, unknown>[] };
  return (json.notices ?? []).map((n) => ({
    noticeId: String(n["publication-number"] ?? ""),
    title: pickLang(n["notice-title"] as LangMap),
    buyer: pickLang(n["buyer-name"] as LangMap),
    deadline: (n["deadline-receipt-tender-date-lot"] as string[] | undefined)?.[0] ?? null,
  }));
}

export async function fetchNoticeXml(noticeId: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const res = await fetchImpl(`https://ted.europa.eu/en/notice/${noticeId}/xml`, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(TED_TIMEOUT_MS),
  });
  if (res.status === 404) throw new NoticeNotFoundError(noticeId);
  if (!res.ok) throw new Error(`TED notice download failed: HTTP ${res.status}`);
  const body = await res.text();
  if (!body.includes("<ContractNotice")) throw new NoticeNotFoundError(noticeId);
  return body;
}
