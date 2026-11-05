// SAM.gov public daily extract of all contract opportunities (CSV, ~200 MB, no API key, no rate limit).
// Terms of Use allow downloading data from sam.gov/data-services; website scraping stays off-limits.
import type { FlatNotice } from "../ted/flatten";
import { htmlToText } from "./client";

export const SAM_EXTRACT_URL =
  "https://sam.gov/api/prod/fileextractservices/v1/api/download/Contract%20Opportunities/datagov/ContractOpportunitiesFullCSV.csv?privacy=Public";

/** Notice types that invite offers (the API's ptype o,k); presolicitations, awards and special notices are skipped. */
const OFFER_TYPES = new Set(["Solicitation", "Combined Synopsis/Solicitation"]);
const MIN_DESCRIPTION_CHARS = 200;
const SAM_ID = /^[0-9a-f]{32}$/i;

export interface ImportedSamNotice {
  noticeId: string;
  title: string;
  solicitationNumber: string | null;
  agency: string;
  postedAt: string;
  responseDeadline: string | null;
  naics: string | null;
  setAside: string | null;
  link: string;
  flat: FlatNotice;
}

/** Streaming RFC 4180 parser: quoted fields may hold commas, doubled quotes and newlines, split across chunks. */
export async function* parseCsv(chunks: AsyncIterable<string>): AsyncGenerator<string[]> {
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let pendingQuote = false; // saw a quote inside a quoted field; the next char decides (escaped quote or field end)
  for await (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i++) {
      const c = chunk[i]!;
      if (pendingQuote) {
        pendingQuote = false;
        if (c === '"') {
          field += '"';
          continue;
        }
        quoted = false;
      }
      if (quoted) {
        if (c === '"') pendingQuote = true;
        else field += c;
        continue;
      }
      if (c === '"' && field === "") quoted = true;
      else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n") {
        row.push(field);
        yield row;
        row = [];
        field = "";
      } else if (c !== "\r") field += c;
    }
  }
  if (pendingQuote) quoted = false;
  if (field !== "" || row.length > 0) {
    row.push(field);
    yield row;
  }
}

/** Officials' contact details are not needed for the analysis and should not travel to models or reports. */
export function redactContacts(text: string): string {
  return text
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email removed]")
    .replace(/\(?\b\d{3}\)?[-.\s]?\d{3}[-.]\d{4}\b/g, "[phone removed]");
}

/** Windows-1252 artefacts in the extract: a stray "Â" left over from non-breaking spaces. */
const cleanText = (s: string) => redactContacts(htmlToText(s.replace(/Â(?=[\s ])/g, "")));
const one = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
const orNull = (s: string | undefined) => one(s) || null;

/** "2026-11-04 20:47:24" → "2026-11-04T20:47:24Z"; null when unparseable. */
function isoPosted(s: string): string | null {
  const m = s.trim().match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
  return m ? `${m[1]}T${m[2]}Z` : null;
}

/** One extract row → notice, or null when it is not a recent, active offer with a usable description. */
export function extractRowToNotice(rec: Record<string, string>, since: Date): ImportedSamNotice | null {
  const noticeId = one(rec.NoticeId).toLowerCase();
  if (!SAM_ID.test(noticeId) || !OFFER_TYPES.has(one(rec.Type)) || one(rec.Active) !== "Yes") return null;
  const postedAt = isoPosted(rec.PostedDate ?? "");
  if (!postedAt || new Date(postedAt) < since) return null;
  const description = cleanText(rec.Description ?? "");
  if (description.length < MIN_DESCRIPTION_CHARS) return null;

  const agency = [rec["Department/Ind.Agency"], rec["Sub-Tier"], rec.Office].map(one).filter(Boolean).join(".");
  const pop = [rec.PopCity, rec.PopState, rec.PopCountry].map(one).filter(Boolean).join(", ");
  // Same field names and "field: text" format as the API flattener, so prompts and evidence checks are unchanged.
  const fields: [string, string | undefined][] = [
    ["title", rec.Title],
    ["solicitationNumber", rec["Sol#"]],
    ["fullParentPathName", agency],
    ["type", rec.Type],
    ["baseType", rec.BaseType],
    ["typeOfSetAsideDescription", rec.SetASide],
    ["typeOfSetAside", rec.SetASideCode],
    ["postedDate", rec.PostedDate],
    ["responseDeadLine", rec.ResponseDeadLine],
    ["naicsCode", rec.NaicsCode],
    ["classificationCode", rec.ClassificationCode],
    ["active", rec.Active],
    ["organizationType", rec.OrganizationType],
    ["placeOfPerformance", pop],
  ];
  const lines = fields.filter(([, v]) => one(v)).map(([k, v]) => `${k}: ${one(v)}`);
  for (const l of description.split("\n")) lines.push(`description: ${l}`);
  const link = `https://sam.gov/opp/${noticeId}/view`;

  return {
    noticeId,
    title: one(rec.Title),
    solicitationNumber: orNull(rec["Sol#"]),
    agency,
    postedAt,
    responseDeadline: orNull(rec.ResponseDeadLine),
    naics: orNull(rec.NaicsCode),
    setAside: orNull(rec.SetASide),
    link,
    flat: { text: lines.join("\n"), language: "ENG", buyerPlatform: link },
  };
}

export interface ExtractOptions {
  fetchImpl?: typeof fetch;
  now?: () => Date;
  /** Keep notices posted within this many days. Default 30. */
  days?: number;
  url?: string;
}

/** Streams the daily extract and yields recent, active offers with a description. Memory stays flat on the ~200 MB file. */
export async function* readSamExtract(opts: ExtractOptions = {}): AsyncGenerator<ImportedSamNotice> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = (opts.now ?? (() => new Date()))();
  const since = new Date(now.getTime() - (opts.days ?? 30) * 24 * 3600 * 1000);
  const res = await fetchImpl(opts.url ?? SAM_EXTRACT_URL, { redirect: "follow" });
  if (!res.ok || !res.body) throw new Error(`SAM.gov extract download failed (HTTP ${res.status})`);
  const text = res.body.pipeThrough(new TextDecoderStream("windows-1252")) as unknown as AsyncIterable<string>;

  let header: string[] | null = null;
  for await (const row of parseCsv(text)) {
    if (!header) {
      header = row.map((h) => h.replace(/^﻿/, ""));
      continue;
    }
    const rec: Record<string, string> = {};
    header.forEach((h, i) => (rec[h] = row[i] ?? ""));
    const notice = extractRowToNotice(rec, since);
    if (notice) yield notice;
  }
}
