import { NoticeNotFoundError, type NoticeSummary } from "../ted/client";
import type { FlatNotice } from "../ted/flatten";

const SAM_SEARCH_URL = "https://api.sam.gov/opportunities/v2/search";
const SAM_DESC_URL = "https://api.sam.gov/prod/opportunities/v1/noticedesc";
const TIMEOUT_MS = 30_000;
/** Default list: IT services and software (computer programming, systems design, other computer services, data processing). */
export const DEFAULT_SAM_NAICS = ["541511", "541512", "541519", "518210"] as const;

export class SamConfigError extends Error {
  constructor() {
    super("SAM_API_KEY is not configured (SAM.gov → Account Details → Public API Key)");
    this.name = "SamConfigError";
  }
}

export interface SamOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

export type SamOpportunity = Record<string, unknown> & { noticeId?: string; title?: string; description?: string; uiLink?: string };

const mmddyyyy = (d: Date) =>
  `${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}/${d.getUTCFullYear()}`;
const daysAgo = (now: Date, days: number) => new Date(now.getTime() - days * 24 * 3600 * 1000);

/** Strips HTML from SAM.gov descriptions: block tags become line breaks, entities are decoded, whitespace collapsed per line. */
export function htmlToText(html: string): string {
  const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };
  return html
    .replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
      if (entities[e.toLowerCase()] !== undefined) return entities[e.toLowerCase()]!;
      if (e.startsWith("#x")) return String.fromCodePoint(parseInt(e.slice(2), 16));
      if (e.startsWith("#")) return String.fromCodePoint(parseInt(e.slice(1), 10));
      return m;
    })
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

async function samGet(url: string, fetchImpl: typeof fetch): Promise<Response> {
  const res = await fetchImpl(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  // The SAM.gov gateway answers an unknown or missing key with an empty 404/403.
  if (!res.ok) throw new Error(`SAM.gov API rejected the request (HTTP ${res.status}); check SAM_API_KEY and daily rate limits`);
  return res;
}

function searchUrl(params: Record<string, string>, apiKey: string): string {
  const q = new URLSearchParams({ ...params, api_key: apiKey });
  return `${SAM_SEARCH_URL}?${q.toString()}`;
}

const lastSegment = (path: unknown) => (typeof path === "string" ? (path.split(".").pop() ?? path).trim() : "");

/** Recent solicitations for the given NAICS codes (one API call per code; results merged by noticeId). */
export async function searchSamOpportunities(opts: SamOptions & { naics?: readonly string[]; days?: number; limit?: number }): Promise<NoticeSummary[]> {
  if (!opts.apiKey) throw new SamConfigError();
  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = (opts.now ?? (() => new Date()))();
  const seen = new Map<string, NoticeSummary>();
  for (const ncode of opts.naics ?? DEFAULT_SAM_NAICS) {
    const res = await samGet(
      searchUrl({ postedFrom: mmddyyyy(daysAgo(now, opts.days ?? 30)), postedTo: mmddyyyy(now), ptype: "o,k", ncode, limit: String(opts.limit ?? 10) }, opts.apiKey),
      fetchImpl,
    );
    const json = (await res.json()) as { opportunitiesData?: SamOpportunity[] };
    for (const o of json.opportunitiesData ?? []) {
      if (!o.noticeId || seen.has(o.noticeId)) continue;
      seen.set(o.noticeId, {
        noticeId: o.noticeId,
        title: String(o.title ?? ""),
        buyer: lastSegment(o.fullParentPathName),
        deadline: typeof o.responseDeadLine === "string" ? o.responseDeadLine : null,
      });
    }
  }
  return [...seen.values()];
}

/** Metadata fields worth reading, in order; the description text is appended last. */
const SAM_FIELDS = [
  "title", "solicitationNumber", "fullParentPathName", "type", "baseType", "typeOfSetAsideDescription", "typeOfSetAside",
  "postedDate", "responseDeadLine", "naicsCode", "classificationCode", "active", "organizationType",
] as const;

function placeOfPerformance(o: SamOpportunity): string | null {
  const p = o.placeOfPerformance as { city?: { name?: string }; state?: { name?: string }; country?: { name?: string } } | undefined;
  const parts = [p?.city?.name, p?.state?.name, p?.country?.name].filter((x): x is string => !!x && x.trim().length > 0);
  return parts.length ? parts.join(", ") : null;
}

/** Same "field: text" format as the TED flatteners, so prompts and evidence verification work unchanged. */
export function flattenSamOpportunity(o: SamOpportunity, descriptionText: string | null): FlatNotice {
  const lines: string[] = [];
  for (const f of SAM_FIELDS) {
    const v = o[f];
    if (v === null || v === undefined || String(v).trim() === "") continue;
    lines.push(`${f}: ${String(v).replace(/\s+/g, " ").trim()}`);
  }
  const pop = placeOfPerformance(o);
  if (pop) lines.push(`placeOfPerformance: ${pop}`);
  if (descriptionText) for (const l of descriptionText.split("\n")) lines.push(`description: ${l}`);
  return { text: lines.join("\n"), language: "ENG", buyerPlatform: typeof o.uiLink === "string" ? o.uiLink : null };
}

/** One notice by id: search (requires a posted-date window, max one year) plus its description text. */
export async function fetchSamNotice(noticeId: string, opts: SamOptions): Promise<FlatNotice> {
  if (!opts.apiKey) throw new SamConfigError();
  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = (opts.now ?? (() => new Date()))();
  const res = await samGet(
    searchUrl({ noticeid: noticeId, postedFrom: mmddyyyy(daysAgo(now, 364)), postedTo: mmddyyyy(now), limit: "1" }, opts.apiKey),
    fetchImpl,
  );
  const json = (await res.json()) as { opportunitiesData?: SamOpportunity[] };
  const opp = json.opportunitiesData?.[0];
  if (!opp) throw new NoticeNotFoundError(noticeId, "SAM.gov returned no opportunity with this notice id in the last year");

  let descriptionText: string | null = null;
  try {
    const descUrl = new URL(typeof opp.description === "string" && opp.description.startsWith("http") ? opp.description : `${SAM_DESC_URL}?noticeid=${noticeId}`);
    descUrl.searchParams.set("api_key", opts.apiKey);
    const d = await samGet(descUrl.toString(), fetchImpl);
    const raw = await d.text();
    let html = raw;
    try {
      html = String((JSON.parse(raw) as { description?: string }).description ?? "");
    } catch {
      /* plain text/HTML body */
    }
    const text = htmlToText(html);
    descriptionText = /^description not found$/i.test(text.trim()) ? null : text;
  } catch {
    descriptionText = null; // metadata alone still allows S1/S7/S8-type checks
  }
  return flattenSamOpportunity(opp, descriptionText);
}
