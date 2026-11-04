import { NoticeNotFoundError } from "./client";
import type { FlatNotice } from "./flatten";

const TED_SEARCH_URL = "https://api.ted.europa.eu/v3/notices/search";
const USER_AGENT = "Tendr/0.1";
const TIMEOUT_MS = 30_000;

/** Content-bearing eForms fields the TED API can return for a contract notice, in reading order. */
export const NOTICE_FIELDS = [
  "publication-number", "publication-date", "notice-type", "form-type", "procedure-type", "procedure-accelerated", "procedure-features",
  "official-language", "buyer-name", "buyer-country", "buyer-legal-type", "buyer-internet-address", "buyer-profile",
  "title-proc", "title-lot", "description-proc", "description-lot", "description-part",
  "classification-cpv", "main-classification-proc", "additional-classification-proc",
  "estimated-value-proc", "estimated-value-cur-proc", "estimated-value-lot", "estimated-value-cur-lot",
  "lots-max-allowed-proc", "lot-included-proc", "identifier-lot",
  "deadline-receipt-tender-date-lot", "deadline-receipt-tender-time-lot",
  "duration-period-value-lot", "duration-period-unit-lot",
  "award-criterion-name-lot", "award-criterion-type-lot", "award-criterion-description-lot",
  "award-criterion-number-weight-lot", "award-criterion-number-fixed-lot", "award-criterion-complicated-lot",
  "selection-criterion-name-lot", "selection-criterion-lot", "selection-criterion-used-lot", "selection-criterion-description-lot",
  "exclusion-grounds", "exclusion-grounds-description",
  "guarantee-required-lot", "guarantee-required-description-lot",
  "terms-financial-lot", "term-performance-lot", "tenderer-legal-form-description-lot", "subcontracting-obligation-lot",
  "variant-allowed-lot", "electronic-auction-lot", "framework-agreement-lot", "reserved-participation-part", "gpa-lot",
  "additional-information", "additional-info-proc", "additional-information-lot",
  "document-url-lot", "document-restricted-lot", "document-restricted-justification", "submission-url-lot", "submission-language",
  "place-of-performance-country-proc", "place-of-performance-city-lot", "legal-basis-proc", "review-deadline-description-lot", "tool-name-lot",
] as const;

export type ApiNotice = Record<string, unknown>;

/** Fetches one notice through the official TED search API (works from cloud IPs, unlike the website). */
export async function fetchNoticeViaApi(noticeId: string, fetchImpl: typeof fetch = fetch): Promise<ApiNotice> {
  const res = await fetchImpl(TED_SEARCH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
    body: JSON.stringify({ query: `publication-number=${noticeId}`, fields: [...NOTICE_FIELDS], limit: 1, page: 1 }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`TED API failed: HTTP ${res.status}`);
  const json = (await res.json()) as { notices?: ApiNotice[] };
  const notice = json.notices?.[0];
  if (!notice) throw new NoticeNotFoundError(noticeId, "TED API returned no notice for this publication number");
  return notice;
}

const LANG_CODES = /^[a-z]{3}$/;

function isLangMap(v: unknown): v is Record<string, string | string[]> {
  return !!v && typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).every((k) => LANG_CODES.test(k));
}

function pickLang(map: Record<string, string | string[]>, language: string): string[] {
  const key = [language.toLowerCase(), "eng", ...Object.keys(map)].find((k) => map[k] !== undefined);
  const v = key ? map[key] : undefined;
  return v === undefined ? [] : Array.isArray(v) ? v : [v];
}

/** Flattens an API notice into the same "field: text" line format the XML flattener produces. */
export function flattenApiNotice(notice: ApiNotice): FlatNotice {
  const official = notice["official-language"];
  const language = (Array.isArray(official) ? String(official[0] ?? "") : String(official ?? "")).toUpperCase() || "ENG";
  const lines: string[] = [];
  for (const field of NOTICE_FIELDS) {
    const value = notice[field];
    if (value === undefined || value === null) continue;
    const texts: string[] = isLangMap(value)
      ? pickLang(value, language)
      : Array.isArray(value)
        ? value.flatMap((v) => (isLangMap(v) ? pickLang(v, language) : [String(v)]))
        : [String(value)];
    for (const t of texts) {
      const clean = t.replace(/\s+/g, " ").trim();
      if (clean.length >= 2) lines.push(`${field}: ${clean}`);
    }
  }
  const submission = notice["submission-url-lot"] ?? notice["document-url-lot"];
  const buyerPlatform = Array.isArray(submission) ? String(submission[0] ?? "") || null : typeof submission === "string" ? submission : null;
  return { text: lines.filter((l, i) => l !== lines[i - 1]).join("\n"), language, buyerPlatform };
}
