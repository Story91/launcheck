// The seven free LaunchCheck checks (spec 2026-11-06 section 4.1). Every finding comes from a deterministic rule with
// template copy (explainedBy "template"); copy follows the wording rules in ../wording.ts (no verdicts, no claims).
import { createHash } from "node:crypto";
import { isIP } from "node:net";
import type { CheckOutcome, FreeCheckDeps } from "../engine";
import type { LaunchCheckCheck, LaunchCheckEvidence, LaunchCheckFinding } from "../types";
import {
  LAUNCHCHECK_FETCH_TIMEOUT_MS,
  LAUNCHCHECK_MAX_REDIRECTS,
  classifyLaunchCheckFetchError,
  safeFetch,
  type SafeFetchResult,
} from "./ssrf";

export const LAUNCHCHECK_FREE_CHECK_IDS = ["page_fetch", "security_headers", "tls_cert", "share_tags", "og_image_fetch", "email_dns", "link_status"] as const;
export type LaunchCheckFreeCheckId = (typeof LAUNCHCHECK_FREE_CHECK_IDS)[number];

export const LAUNCHCHECK_FREE_CHECK_LABELS: Record<LaunchCheckFreeCheckId, string> = {
  page_fetch: "Page response",
  security_headers: "Security headers",
  tls_cert: "TLS certificate",
  share_tags: "Link preview tags",
  og_image_fetch: "Link preview image",
  email_dns: "Email DNS records",
  link_status: "Selected links",
};

export const LAUNCHCHECK_MAX_LINKS = 10;
const TITLE_MAX = 60;
const CERT_MIN_DAYS = 21;
const JS_SHELL_MIN_LINKS = 3;
const JS_SHELL_MIN_TEXT = 2048;
const LINK_CONCURRENCY = 5;
const CTA_TEXT = /\b(sign ?up|get started|pricing|docs|log ?in|login|try|start|book|contact)\b/i;

// ---------- HTML extraction (static HTML only, no dependencies) ----------

export interface LaunchCheckHtmlLink {
  url: string;
  text: string;
  /** Inside <nav> or <header>. */
  inNav: boolean;
}

export interface LaunchCheckParsedHtml {
  title: string | null;
  /** meta name/property (lower-case) -> content; first occurrence wins. */
  meta: Record<string, string>;
  canonical: string | null;
  lang: string | null;
  /** Unique http(s) links in document order, fragment removed. */
  links: LaunchCheckHtmlLink[];
  textLength: number;
  jsShell: boolean;
}

const NAMED_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, body: string) => {
    const lower = body.toLowerCase();
    if (lower.startsWith("#x")) {
      const cp = parseInt(lower.slice(2), 16);
      return Number.isFinite(cp) && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
    }
    if (lower.startsWith("#")) {
      const cp = parseInt(lower.slice(1), 10);
      return Number.isFinite(cp) && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
    }
    return NAMED_ENTITIES[lower] ?? m;
  });
}

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

function parseAttributes(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const m of raw.matchAll(re)) {
    const name = m[1]!.toLowerCase();
    if (name in attrs) continue;
    attrs[name] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
  }
  return attrs;
}

function resolveHttpUrl(href: string, base: string): string | null {
  const h = href.trim();
  if (h === "" || h.startsWith("#") || /^(mailto|tel|javascript|data|sms):/i.test(h)) return null;
  try {
    const u = new URL(h, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    return u.href;
  } catch {
    return null;
  }
}

/** Small tokenizer-based extractor for the tags LaunchCheck reads. Script/style/template/comment content is skipped. */
export function parseLaunchCheckHtml(html: string, baseUrl: string): LaunchCheckParsedHtml {
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ");
  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)((?:\s+[^\s"'>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>/g;

  let base = baseUrl;
  let title: string | null = null;
  let titleStart = -1;
  const meta: Record<string, string> = {};
  let canonical: string | null = null;
  let lang: string | null = null;
  const links: LaunchCheckHtmlLink[] = [];
  const seen = new Set<string>();
  let navDepth = 0;
  let svgDepth = 0;
  let anchor: { url: string | null; inNav: boolean; text: string[] } | null = null;
  const text: string[] = [];
  let last = 0;

  const closeAnchor = () => {
    if (anchor?.url && !seen.has(anchor.url)) {
      seen.add(anchor.url);
      links.push({ url: anchor.url, text: collapse(decodeEntities(anchor.text.join(" "))), inNav: anchor.inNav });
    }
    anchor = null;
  };

  for (const m of cleaned.matchAll(tagRe)) {
    const chunk = cleaned.slice(last, m.index);
    last = m.index + m[0].length;
    if (titleStart < 0) {
      text.push(chunk);
      anchor?.text.push(chunk);
    }
    const closing = m[1] === "/";
    const tag = m[2]!.toLowerCase();
    const attrs = closing ? {} : parseAttributes(m[3] ?? "");

    if (tag === "title" && svgDepth === 0) {
      if (!closing && title === null && titleStart < 0) titleStart = last;
      else if (closing && titleStart >= 0) {
        title = collapse(decodeEntities(cleaned.slice(titleStart, m.index).replace(/<[^>]*>/g, " ")));
        titleStart = -2; // only the first <title>
      }
      continue;
    }
    if (titleStart >= 0) continue; // inside <title>: everything is text
    switch (tag) {
      case "svg":
        svgDepth += closing ? -1 : 1;
        if (svgDepth < 0) svgDepth = 0;
        break;
      case "nav":
      case "header":
        navDepth += closing ? -1 : 1;
        if (navDepth < 0) navDepth = 0;
        break;
      case "html":
        if (!closing && lang === null && attrs.lang) lang = attrs.lang.trim();
        break;
      case "base":
        if (!closing && attrs.href) {
          try { base = new URL(attrs.href, baseUrl).href; } catch { /* keep page URL */ }
        }
        break;
      case "meta": {
        const key = (attrs.name ?? attrs.property ?? "").toLowerCase().trim();
        if (key && attrs.content !== undefined && !(key in meta)) meta[key] = collapse(attrs.content);
        break;
      }
      case "link":
        if (!closing && canonical === null && (attrs.rel ?? "").toLowerCase().split(/\s+/).includes("canonical") && attrs.href) {
          try { canonical = new URL(attrs.href, base).href; } catch { /* ignore */ }
        }
        break;
      case "a":
        if (closing) closeAnchor();
        else {
          closeAnchor();
          anchor = { url: attrs.href !== undefined ? resolveHttpUrl(attrs.href, base) : null, inNav: navDepth > 0, text: [] };
        }
        break;
    }
  }
  closeAnchor();
  if (titleStart < 0) text.push(cleaned.slice(last));
  const textLength = collapse(decodeEntities(text.join(" "))).length;
  return { title, meta, canonical, lang, links, textLength, jsShell: links.length < JS_SHELL_MIN_LINKS || textLength < JS_SHELL_MIN_TEXT };
}

// ---------- shared builders ----------

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const fromVercel = (deps: FreeCheckDeps) => `checked from Vercel ${deps.region}`;

function makeEvidence(
  checkId: LaunchCheckFreeCheckId,
  deps: FreeCheckDeps,
  label: string,
  fields: Record<string, unknown>,
  scopeNote: string,
  kind: LaunchCheckEvidence["kind"] = "json",
): LaunchCheckEvidence {
  return {
    id: `ev_${checkId}`,
    checkId,
    kind,
    label,
    blobUrl: null,
    sha256: sha256(canonicalJson(fields)),
    capturedAt: deps.now().toISOString(),
    source: { type: "free", vendorHost: null, endpoint: null },
    scopeNote,
    fields,
  };
}

type Severity = LaunchCheckFinding["severity"];
type Draft = Omit<LaunchCheckFinding, "id" | "checkId" | "evidenceIds" | "explainedBy">;

function draft(ruleId: string, severity: Severity, title: string, observed: string, explanation: string, fix: string): Draft {
  return { ruleId, severity, title, observed, explanation, fix };
}

/** Assembles a CheckOutcome; finding ids are f_<ruleId>, or f_<ruleId>_<n> when a rule fires more than once. */
function assemble(
  checkId: LaunchCheckFreeCheckId,
  evidence: LaunchCheckEvidence[],
  drafts: Draft[],
  scopeNote: string | null,
  notCheckedReason: LaunchCheckCheck["notCheckedReason"] = null,
): CheckOutcome {
  const evidenceIds = evidence.map((e) => e.id);
  const totals = new Map<string, number>();
  for (const d of drafts) totals.set(d.ruleId, (totals.get(d.ruleId) ?? 0) + 1);
  const counters = new Map<string, number>();
  const findings: LaunchCheckFinding[] = notCheckedReason ? [] : drafts.map((d) => {
    const n = (counters.get(d.ruleId) ?? 0) + 1;
    counters.set(d.ruleId, n);
    const id = totals.get(d.ruleId)! > 1 ? `f_${d.ruleId}_${n}` : `f_${d.ruleId}`;
    return { id, checkId, evidenceIds, explainedBy: "template", ...d };
  });
  const state: LaunchCheckCheck["state"] = notCheckedReason ? "not_checked" : findings.length > 0 ? "problem" : "clear";
  return {
    check: { checkId, label: LAUNCHCHECK_FREE_CHECK_LABELS[checkId], kind: "free", state, notCheckedReason, evidenceIds, scopeNote },
    evidence,
    findings,
  };
}

function errorCode(err: unknown): string {
  const e = err as { code?: string; name?: string; cause?: { code?: string } } | null;
  return e?.code ?? e?.cause?.code ?? e?.name ?? "unknown_error";
}

// ---------- page context ----------

export interface LaunchCheckFreePage {
  requestedUrl: string;
  response: SafeFetchResult;
  html: LaunchCheckParsedHtml;
}

/** Fetches the page (GET, capped) and parses its static HTML. Throws when the page is unreachable. */
export async function loadLaunchCheckFreePage(url: string, deps: FreeCheckDeps): Promise<LaunchCheckFreePage> {
  const response = await safeFetch(url, deps, { body: "text" });
  const html = parseLaunchCheckHtml(response.bodyText ?? "", response.finalUrl);
  return { requestedUrl: url, response, html };
}

// ---------- page_fetch ----------

export async function freeCheckPageFetch(page: LaunchCheckFreePage, deps: FreeCheckDeps): Promise<CheckOutcome> {
  const r = page.response;
  const final = new URL(r.finalUrl);
  const requested = new URL(page.requestedUrl);
  let httpProbe: { url: string; status: number | null; finalUrl: string | null; redirectsToHttps: boolean | null; error: string | null };
  if (requested.protocol === "http:") {
    httpProbe = { url: requested.href, status: r.status, finalUrl: r.finalUrl, redirectsToHttps: final.protocol === "https:", error: null };
  } else {
    const probeUrl = `http://${final.host}${final.pathname}${final.search}`;
    try {
      const p = await safeFetch(probeUrl, deps, { body: "none" });
      httpProbe = { url: probeUrl, status: p.status, finalUrl: p.finalUrl, redirectsToHttps: new URL(p.finalUrl).protocol === "https:", error: null };
    } catch (err) {
      httpProbe = { url: probeUrl, status: null, finalUrl: null, redirectsToHttps: null, error: errorCode(err) };
    }
  }
  const fields = {
    requestedUrl: page.requestedUrl,
    finalUrl: r.finalUrl,
    status: r.status,
    redirectChain: r.redirectChain,
    contentType: r.headers["content-type"] ?? null,
    htmlBytes: r.bodyBytes,
    truncated: r.truncated,
    textLength: page.html.textLength,
    linksFound: page.html.links.length,
    jsShell: page.html.jsShell,
    elapsedMs: r.elapsedMs,
    region: deps.region,
    httpProbe,
  };
  const scope = fromVercel(deps);
  const ev = makeEvidence("page_fetch", deps, "Homepage response", fields, scope);
  const drafts: Draft[] = [];
  if (r.status < 200 || r.status > 299) {
    drafts.push(draft("page_status_error", "fix_before_launch", `The page returns HTTP ${r.status}`,
      `GET ${r.finalUrl} answered HTTP ${r.status} from Vercel ${deps.region}.`,
      "Visitors and link preview crawlers receive this status instead of the page content.",
      "Make the URL answer with a 2xx status, or point your launch link to a URL that does."));
  }
  if (httpProbe.redirectsToHttps === false) {
    drafts.push(draft("http_not_redirected", "fix_soon", "Plain HTTP does not redirect to HTTPS",
      `GET ${httpProbe.url} ended at ${httpProbe.finalUrl} (HTTP ${httpProbe.status}) without moving to https://.`,
      "Visitors who type the address without https:// stay on an unencrypted connection.",
      "Add a permanent (301 or 308) redirect from every http:// URL to the same https:// URL."));
  }
  return assemble("page_fetch", [ev], drafts, scope);
}

// ---------- security_headers ----------

export async function freeCheckSecurityHeaders(page: LaunchCheckFreePage, deps: FreeCheckDeps): Promise<CheckOutcome> {
  const h = page.response.headers;
  const csp = h["content-security-policy"] ?? null;
  const frameAncestors = csp?.split(";").map((d) => d.trim()).find((d) => /^frame-ancestors\b/i.test(d))?.replace(/^frame-ancestors\s*/i, "") ?? null;
  const fields = {
    url: page.response.finalUrl,
    "strict-transport-security": h["strict-transport-security"] ?? null,
    "content-security-policy": csp,
    "content-security-policy-report-only": h["content-security-policy-report-only"] ?? null,
    frameAncestors,
    "x-frame-options": h["x-frame-options"] ?? null,
    "x-content-type-options": h["x-content-type-options"] ?? null,
    "referrer-policy": h["referrer-policy"] ?? null,
  };
  const scope = fromVercel(deps);
  const ev = makeEvidence("security_headers", deps, "Homepage response headers", fields, scope);
  const drafts: Draft[] = [];
  if (!fields["strict-transport-security"]) {
    drafts.push(draft("hsts_missing", "fix_soon", "No HSTS header on the homepage response",
      `The response from ${page.response.finalUrl} has no Strict-Transport-Security header.`,
      "Without HSTS, browsers may make the first request of a visit over plain HTTP before following your redirect.",
      "Send Strict-Transport-Security: max-age=31536000; includeSubDomains on HTTPS responses."));
  }
  if (!csp) {
    drafts.push(draft("csp_missing", "fyi", "No Content-Security-Policy header on the homepage response",
      `The response from ${page.response.finalUrl} has no Content-Security-Policy header.`,
      "A Content-Security-Policy tells browsers which scripts, styles and frames the page may load. Without it, browsers apply no such limits.",
      "Add a Content-Security-Policy header; start with a report-only policy to see what it would block."));
  }
  if (!fields["x-content-type-options"]) {
    drafts.push(draft("xcto_missing", "fyi", "No X-Content-Type-Options header on the homepage response",
      `The response from ${page.response.finalUrl} has no X-Content-Type-Options header.`,
      "Without X-Content-Type-Options: nosniff, browsers may guess a file type instead of using the declared Content-Type.",
      "Send X-Content-Type-Options: nosniff on all responses."));
  }
  return assemble("security_headers", [ev], drafts, scope);
}

// ---------- tls_cert ----------

function sanNames(sans: string[]): { dns: string[]; ip: string[] } {
  const dns: string[] = [];
  const ip: string[] = [];
  for (const raw of sans.flatMap((s) => s.split(","))) {
    const s = raw.trim();
    if (/^dns:/i.test(s)) dns.push(s.slice(4).trim().toLowerCase());
    else if (/^ip address:/i.test(s)) ip.push(s.slice(11).trim().toLowerCase());
    else if (s) dns.push(s.toLowerCase());
  }
  return { dns, ip };
}

function hostMatches(host: string, sans: string[]): boolean {
  const h = host.toLowerCase().replace(/\.$/, "");
  const { dns, ip } = sanNames(sans);
  if (isIP(h)) return ip.includes(h);
  return dns.some((name) => {
    if (name === h) return true;
    if (!name.startsWith("*.")) return false;
    const suffix = name.slice(1); // ".example.com"
    return h.endsWith(suffix) && !h.slice(0, -suffix.length).includes(".") && h.length > suffix.length;
  });
}

export async function freeCheckTlsCert(page: LaunchCheckFreePage, deps: FreeCheckDeps): Promise<CheckOutcome> {
  const host = new URL(page.response.finalUrl).hostname.replace(/^\[|\]$/g, "");
  const scope = fromVercel(deps);
  let cert: Awaited<ReturnType<FreeCheckDeps["peerCertificate"]>>;
  try {
    cert = await deps.peerCertificate(host);
  } catch (err) {
    const code = errorCode(err);
    const ev = makeEvidence("tls_cert", deps, "TLS handshake", { host, port: 443, errorCode: code }, scope);
    const timedOut = classifyLaunchCheckFetchError(err) === "timeout";
    return assemble("tls_cert", [ev], [], scope, timedOut ? "timeout" : "blocked_from_our_server");
  }
  const now = deps.now();
  const validTo = new Date(cert.validTo);
  const daysLeft = Math.floor((validTo.getTime() - now.getTime()) / 86_400_000);
  const matches = hostMatches(host, cert.subjectAltNames);
  const fields = { host, port: 443, issuer: cert.issuer, validFrom: cert.validFrom, validTo: cert.validTo, daysLeft, subjectAltNames: cert.subjectAltNames, hostMatches: matches };
  const ev = makeEvidence("tls_cert", deps, "TLS certificate", fields, scope);
  const drafts: Draft[] = [];
  if (Number.isNaN(daysLeft) || daysLeft < CERT_MIN_DAYS) {
    const title = Number.isNaN(daysLeft) ? "The TLS certificate end date could not be read"
      : daysLeft < 0 ? `The TLS certificate expired ${-daysLeft} days ago`
      : `The TLS certificate expires in ${daysLeft} days`;
    drafts.push(draft("cert_expiring", "fix_before_launch", title,
      `Certificate for ${host} issued by ${cert.issuer} is valid until ${cert.validTo}.`,
      "Once the certificate expires, browsers show a full-page warning instead of your site.",
      "Renew the certificate or check that automatic renewal is running, then re-run this check."));
  }
  if (!matches) {
    drafts.push(draft("cert_host_mismatch", "fix_before_launch", "The TLS certificate does not list this host name",
      `The certificate served for ${host} lists: ${cert.subjectAltNames.join(", ") || "no names"}.`,
      "Browsers show a warning when the certificate does not cover the host name in the address bar.",
      `Issue a certificate that includes ${host}, or serve the site from a host name the certificate covers.`));
  }
  return assemble("tls_cert", [ev], drafts, scope);
}

// ---------- share_tags ----------

export async function freeCheckShareTags(page: LaunchCheckFreePage, deps: FreeCheckDeps): Promise<CheckOutcome> {
  const { html } = page;
  const m = html.meta;
  const base = page.response.finalUrl;
  const absolute = (v: string | undefined) => {
    if (!v) return null;
    try { return new URL(v, base).href; } catch { return v; }
  };
  const fields = {
    url: base,
    title: html.title,
    titleLength: html.title === null ? null : [...html.title].length,
    metaDescription: m["description"] ?? null,
    viewport: m["viewport"] ?? null,
    lang: html.lang,
    canonical: html.canonical,
    ogTitle: m["og:title"] ?? null,
    ogDescription: m["og:description"] ?? null,
    ogImage: absolute(m["og:image"] ?? m["og:image:url"] ?? m["og:image:secure_url"]),
    twitterCard: m["twitter:card"] ?? null,
    twitterImage: absolute(m["twitter:image"]),
    jsShell: html.jsShell,
    truncated: page.response.truncated,
  };
  const scope = `static HTML only, ${fromVercel(deps)}`;
  const ev = makeEvidence("share_tags", deps, "Link preview and page tags", fields, scope);
  const drafts: Draft[] = [];
  const where = `the static HTML of ${base}`;
  if (!fields.ogImage) {
    drafts.push(draft("og_image_missing", "fix_before_launch", "Link preview has no image", `No og:image tag in ${where}.`,
      "When the link is shared, platforms have no picture to show in the preview card. Some platforms pick their own fallback or show none.",
      "Add <meta property=\"og:image\" content=\"https://...\"> with an absolute HTTPS URL to an image of about 1200x630 px."));
  }
  if (!fields.ogTitle) {
    drafts.push(draft("og_title_missing", "fix_soon", "Link preview has no og:title", `No og:title tag in ${where}.`,
      "Platforms fall back to the page title or the URL for the headline of the preview card.",
      "Add <meta property=\"og:title\" content=\"...\"> with the headline you want in shared links."));
  }
  if (!fields.twitterCard) {
    drafts.push(draft("twitter_card_missing", "fix_soon", "No twitter:card tag", `No twitter:card tag in ${where}.`,
      "Without twitter:card, X shows a small preview or none instead of a large image card.",
      "Add <meta name=\"twitter:card\" content=\"summary_large_image\">."));
  }
  if (!fields.viewport) {
    drafts.push(draft("viewport_missing", "fix_before_launch", "No viewport meta tag", `No <meta name="viewport"> in ${where}.`,
      "Phone browsers render pages without a viewport tag at desktop width and shrink them, so text appears tiny.",
      "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"> to the <head>."));
  }
  if (fields.titleLength !== null && fields.titleLength > TITLE_MAX) {
    drafts.push(draft("title_too_long", "fyi", `The page title is ${fields.titleLength} characters long`, `<title> in ${where}: "${html.title}".`,
      `Search results and browser tabs usually cut titles after about ${TITLE_MAX} characters.`,
      `Shorten the <title> to ${TITLE_MAX} characters or fewer, with the product name first.`));
  }
  if (!fields.metaDescription) {
    drafts.push(draft("meta_description_missing", "fyi", "No meta description", `No <meta name="description"> in ${where}.`,
      "Search engines and some link previews then pick a text snippet from the page themselves.",
      "Add <meta name=\"description\" content=\"...\"> with one or two sentences about the product."));
  }
  return assemble("share_tags", [ev], drafts, scope);
}

// ---------- og_image_fetch ----------

export async function freeCheckOgImageFetch(page: LaunchCheckFreePage, deps: FreeCheckDeps): Promise<CheckOutcome> {
  const scope = fromVercel(deps);
  const raw = page.html.meta["og:image"] ?? page.html.meta["og:image:url"] ?? page.html.meta["og:image:secure_url"];
  if (!raw) return assemble("og_image_fetch", [], [], scope, "not_applicable");
  let imageUrl: string;
  try { imageUrl = new URL(raw, page.response.finalUrl).href; } catch { imageUrl = raw; }
  let r: SafeFetchResult;
  try {
    r = await safeFetch(imageUrl, deps, { body: "count" });
  } catch (err) {
    const kind = classifyLaunchCheckFetchError(err);
    const ev = makeEvidence("og_image_fetch", deps, "Link preview image request", { url: imageUrl, error: kind, errorCode: errorCode(err) }, scope);
    return assemble("og_image_fetch", [ev], [], scope, kind === "timeout" ? "timeout" : "blocked_from_our_server");
  }
  const contentType = r.headers["content-type"] ?? null;
  const declared = r.headers["content-length"] ? Number(r.headers["content-length"]) : null;
  const fields = { url: imageUrl, finalUrl: r.finalUrl, status: r.status, contentType, bytes: r.bodyBytes, contentLength: declared, truncated: r.truncated, redirectChain: r.redirectChain, elapsedMs: r.elapsedMs };
  const ev = makeEvidence("og_image_fetch", deps, "Link preview image request", fields, scope);
  const drafts: Draft[] = [];
  const okStatus = r.status >= 200 && r.status <= 299;
  const isImage = (contentType ?? "").toLowerCase().trim().startsWith("image/");
  if (!okStatus || !isImage) {
    const title = !okStatus ? `The link preview image returns HTTP ${r.status}` : "The link preview image URL does not return an image";
    drafts.push(draft("og_image_broken", "fix_before_launch", title,
      `GET ${imageUrl} answered HTTP ${r.status} with Content-Type ${contentType ?? "(none)"}.`,
      "Platforms that fetch this URL for the preview card get no usable image, so the card shows without one.",
      "Point og:image to a public absolute URL that answers 200 with an image Content-Type (image/png or image/jpeg)."));
  }
  return assemble("og_image_fetch", [ev], drafts, scope);
}

// ---------- email_dns ----------

/** Apex used for SPF/DMARC: the host without a leading "www." (no public-suffix list). */
export function launchCheckMailDomain(host: string): string {
  return host.toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
}

export async function freeCheckEmailDns(page: LaunchCheckFreePage, deps: FreeCheckDeps): Promise<CheckOutcome> {
  const scope = fromVercel(deps);
  const host = new URL(page.response.finalUrl).hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return assemble("email_dns", [], [], scope, "not_applicable");
  const domain = launchCheckMailDomain(host);
  const dmarcName = `_dmarc.${domain}`;
  const [apex, dmarc] = await Promise.allSettled([deps.resolveTxt(domain), deps.resolveTxt(dmarcName)]);
  const join = (records: string[][]) => records.map((chunks) => chunks.join(""));
  if (apex.status === "rejected" || dmarc.status === "rejected") {
    const errs = [apex, dmarc].map((s) => (s.status === "rejected" ? errorCode(s.reason) : null));
    const ev = makeEvidence("email_dns", deps, "TXT lookups", { domain, apexError: errs[0], dmarcError: errs[1] }, scope);
    const timedOut = [apex, dmarc].some((s) => s.status === "rejected" && /TIMEOUT/i.test(errorCode(s.reason)));
    return assemble("email_dns", [ev], [], scope, timedOut ? "timeout" : "vendor_error");
  }
  const apexTxt = join(apex.value);
  const dmarcTxt = join(dmarc.value);
  const spf = apexTxt.find((t) => /^v=spf1(\s|$)/i.test(t.trim())) ?? null;
  const dmarcRecord = dmarcTxt.find((t) => /^v=DMARC1\s*(;|$)/i.test(t.trim())) ?? null;
  const policy = dmarcRecord?.match(/(?:^|;)\s*p\s*=\s*([a-z]+)/i)?.[1]?.toLowerCase() ?? null;
  const fields = { domain, apexTxt, dmarcName, dmarcTxt, spf, dmarc: dmarcRecord, dmarcPolicy: policy };
  const ev = makeEvidence("email_dns", deps, "SPF and DMARC TXT records", fields, scope);
  const drafts: Draft[] = [];
  if (!spf) {
    drafts.push(draft("spf_missing", "fix_soon", `No SPF record for ${domain}`, `No TXT record starting with v=spf1 at ${domain}.`,
      "We found no SPF record. Mail providers cannot tell which servers may send email for this domain, so signup and waitlist emails are more likely to land in spam.",
      "Publish a TXT record such as v=spf1 include:<your email provider> -all at the domain apex."));
  }
  if (!dmarcRecord) {
    drafts.push(draft("dmarc_missing", "fix_soon", `No DMARC record for ${domain}`, `No TXT record starting with v=DMARC1 at ${dmarcName}.`,
      "We found no DMARC record. Signup and waitlist emails from this domain are more likely to land in spam.",
      `Publish a TXT record at ${dmarcName}, for example v=DMARC1; p=quarantine; rua=mailto:<your address>.`));
  } else if (policy === "none") {
    drafts.push(draft("dmarc_p_none", "fyi", "The DMARC policy is p=none", `DMARC record at ${dmarcName}: "${dmarcRecord}".`,
      "With p=none, receiving servers only report failures and take no action on mail that fails the check.",
      "After reviewing DMARC reports, move the policy to p=quarantine or p=reject."));
  }
  return assemble("email_dns", [ev], drafts, scope);
}

// ---------- link_status ----------

interface LinkResult {
  url: string;
  text: string;
  method: "HEAD" | "GET" | null;
  status: number | null;
  finalUrl: string | null;
  redirects: number;
  elapsedMs: number | null;
  result: "ok" | "broken" | "redirect_loop" | "blocked" | "private_address";
  error: string | null;
}

const sameSite = (a: string, b: string) => launchCheckMailDomain(a) === launchCheckMailDomain(b);

/** Up to 10 links: navigation/header and CTA-looking links first, then other internal links; the page itself is skipped. */
export function selectLaunchCheckLinks(links: LaunchCheckHtmlLink[], pageUrl: string, max = LAUNCHCHECK_MAX_LINKS): LaunchCheckHtmlLink[] {
  const page = new URL(pageUrl);
  page.hash = "";
  const candidates = links.filter((l) => l.url !== page.href);
  const priority = candidates.filter((l) => l.inNav || CTA_TEXT.test(l.text));
  const internal = candidates.filter((l) => !priority.includes(l) && sameSite(new URL(l.url).hostname, page.hostname));
  return [...priority, ...internal].slice(0, max);
}

async function probeLink(link: LaunchCheckHtmlLink, deps: FreeCheckDeps): Promise<LinkResult> {
  const base = { url: link.url, text: link.text };
  let method: "HEAD" | "GET" = "HEAD";
  try {
    let r = await safeFetch(link.url, deps, { method: "HEAD" });
    if (r.status === 405 || r.status === 501) {
      method = "GET";
      r = await safeFetch(link.url, deps, { method: "GET", headers: { Range: "bytes=0-0" }, body: "none" });
    }
    const common = { ...base, method, status: r.status, finalUrl: r.finalUrl, redirects: r.redirectChain.length, elapsedMs: r.elapsedMs, error: null };
    if (r.status === 403 || r.status === 429) return { ...common, result: "blocked" };
    if (r.status >= 400) return { ...common, result: "broken" };
    return { ...common, result: "ok" };
  } catch (err) {
    const kind = classifyLaunchCheckFetchError(err);
    const common = { ...base, method, status: null, finalUrl: null, elapsedMs: null, error: errorCode(err) };
    if (kind === "redirect_limit") return { ...common, redirects: LAUNCHCHECK_MAX_REDIRECTS + 1, result: "redirect_loop" };
    if (kind === "blocked_url") return { ...common, redirects: 0, result: "private_address" };
    return { ...common, redirects: 0, result: "blocked" };
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export interface LaunchCheckLinkStatusOutcome extends CheckOutcome {
  /** Links that answered 403/429 or did not answer from our server. */
  blockedLinks: string[];
}

export async function freeCheckLinkStatus(page: LaunchCheckFreePage, deps: FreeCheckDeps): Promise<LaunchCheckLinkStatusOutcome> {
  const found = page.html.links.length;
  const selected = selectLaunchCheckLinks(page.html.links, page.response.finalUrl);
  const scope = `checked ${selected.length} of ${found} links from Vercel ${deps.region}`;
  if (selected.length === 0) return { ...assemble("link_status", [], [], scope, "not_applicable"), blockedLinks: [] };
  const results = await mapLimit(selected, LINK_CONCURRENCY, (l) => probeLink(l, deps));
  const blockedLinks = results.filter((r) => r.result === "blocked").map((r) => r.url);
  const fields = { pageUrl: page.response.finalUrl, linksFound: found, linksChecked: selected.length, links: results.map(({ text: _text, ...r }) => r) };
  const ev = makeEvidence("link_status", deps, "Link responses", fields, scope);
  const drafts: Draft[] = [];
  for (const r of results) {
    if (r.result === "broken") {
      drafts.push(draft("link_broken", "fix_before_launch", `A link on the page returns HTTP ${r.status}`,
        `${r.method} ${r.url} answered HTTP ${r.status}${r.finalUrl && r.finalUrl !== r.url ? ` at ${r.finalUrl}` : ""}.`,
        "Visitors who click this link reach an error page instead of the destination.",
        "Publish the missing page, or update the link to an existing destination."));
    } else if (r.result === "redirect_loop") {
      drafts.push(draft("link_redirect_loop", "fix_before_launch", `A link on the page redirects more than ${LAUNCHCHECK_MAX_REDIRECTS} times`,
        `${r.method} ${r.url} was still redirecting after ${LAUNCHCHECK_MAX_REDIRECTS} hops.`,
        "Browsers stop after too many redirects and show an error instead of the destination.",
        "Check the redirect rules for this path so that it reaches a final page in one or two hops."));
    }
  }
  const answered = results.filter((r) => r.result !== "blocked" && r.result !== "private_address").length;
  if (drafts.length === 0 && answered === 0 && blockedLinks.length > 0) {
    return { ...assemble("link_status", [ev], [], scope, "blocked_from_our_server"), blockedLinks };
  }
  return { ...assemble("link_status", [ev], drafts, scope), blockedLinks };
}

/** Timeout text used in unreachable messages. */
export const LAUNCHCHECK_TIMEOUT_SECONDS = LAUNCHCHECK_FETCH_TIMEOUT_MS / 1000;
