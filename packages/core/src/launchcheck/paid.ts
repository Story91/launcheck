// Paid checks: bought by the agent through Kite Passport (x402, USDC on Base). Only checks whose price was confirmed
// by a real purchase are listed (docs/research/07-launchcheck-kite-spike.md). Vendor replies are untrusted data:
// normalizers keep a fixed set of fields and drop ad/advisory blocks and vendor scores.
import type { LaunchCheckFinding, LaunchCheckTier } from "./types";

export type PaidCheckId = "render_desktop" | "render_narrow" | "html_audit" | "browser_navigation";

export interface PaidCheck {
  checkId: PaidCheckId;
  label: string;
  vendorHost: string;
  endpoint: string;
  priceUsd: number;
  tiers: LaunchCheckTier[];
  scopeNote: string;
  /** Why the planner buys it (shown on the plan). */
  reason: string;
}

export const PAID_CHECKS: PaidCheck[] = [
  {
    checkId: "browser_navigation", label: "Public navigation in a browser", vendorHost: "vaaya.ai",
    endpoint: "/api/run/browserbase/create_session", priceUsd: 0.01, tiers: ["full"],
    scopeNote: "Opens this page and clicks one eligible same-origin navigation link in a real 1280px browser. No forms, sign-in, purchases or whole-app coverage.",
    reason: "Tests whether a public link actually navigates after JavaScript renders; a screenshot alone cannot establish this.",
  },
  {
    checkId: "render_desktop",
    label: "Desktop render (1280 px)",
    vendorHost: "web.cyberwarex.com",
    endpoint: "/screenshot",
    priceUsd: 0.005,
    tiers: ["quick", "standard", "full"],
    scopeNote: "First screen in a real headless browser at 1280 px. Appearance only; no interaction test.",
    reason: "Shows what a first-time visitor sees above the fold.",
  },
  {
    checkId: "render_narrow",
    label: "Narrow render (390 px)",
    vendorHost: "web.cyberwarex.com",
    endpoint: "/screenshot",
    priceUsd: 0.005,
    tiers: ["quick", "standard", "full"],
    scopeNote: "390px-wide browser window. Not a phone: no touch, no mobile user agent, no device emulation.",
    reason: "Shows the full page in a narrow window, where layouts most often break.",
  },
  {
    checkId: "html_audit",
    label: "Static HTML second opinion",
    vendorHost: "api.kadec0.xyz",
    endpoint: "/v1/website-audit",
    priceUsd: 0.08,
    tiers: ["standard", "full"],
    scopeNote: "Static HTML analysis by an independent service, not Lighthouse.",
    reason: "An independent second opinion on your HTML from another server.",
  },
];

export const paidChecksForTier = (tier: LaunchCheckTier) => PAID_CHECKS.filter((c) => c.tiers.includes(tier));

export interface PaidRequest {
  url: string;
  method: "GET" | "POST";
  headers: Record<string, string>;
  body?: Record<string, unknown>;
}

export function buildPaidRequest(checkId: PaidCheckId, target: string): PaidRequest {
  const u = encodeURIComponent(target);
  switch (checkId) {
    case "browser_navigation":
      return { url: "https://vaaya.ai/api/run/browserbase/create_session", method: "POST", headers: { "Content-Type": "application/json" }, body: {} };
    case "render_desktop":
      return { url: `https://web.cyberwarex.com/screenshot?url=${u}&fullpage=false&width=1280`, method: "GET", headers: { "X-No-Advert": "1" } };
    case "render_narrow":
      return { url: `https://web.cyberwarex.com/screenshot?url=${u}&fullpage=true&width=390`, method: "GET", headers: { "X-No-Advert": "1" } };
    case "html_audit":
      return { url: `https://api.kadec0.xyz/v1/website-audit?url=${u}`, method: "GET", headers: {} };
  }
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {});

/** cyberwarex screenshot reply → PNG bytes plus the capture parameters. */
export function normalizeScreenshot(body: unknown): { png: Buffer; fields: Record<string, unknown> } | null {
  const b = obj(body);
  if (typeof b.png_base64 !== "string" || b.png_base64.length === 0) return null;
  const fields: Record<string, unknown> = {};
  if (typeof b.width === "number") fields.width = b.width;
  if (typeof b.fullpage === "boolean") fields.fullpage = b.fullpage;
  return { png: Buffer.from(b.png_base64, "base64"), fields };
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown) => (typeof v === "string" ? v : null);

/** kadec0 website-audit reply → fixed evidence fields (vendor score removed) and at most one FYI finding. */
export function normalizeAudit(body: unknown, evidenceId: string): { fields: Record<string, unknown>; findings: LaunchCheckFinding[] } | null {
  const items = obj(body).items;
  const item = Array.isArray(items) ? obj(items[0]) : obj(body);
  if (typeof item.httpStatus !== "number" || !Number.isInteger(item.httpStatus) || item.httpStatus < 100 || item.httpStatus > 599 || !Array.isArray(item.issues) || item.issues.some(i => typeof i !== "string")) return null;
  const images = obj(item.images);
  const issues = Array.isArray(item.issues) ? item.issues.filter((i): i is string => typeof i === "string").map((i) => i.slice(0, 200)).slice(0, 20) : [];
  const fields: Record<string, unknown> = {
    httpStatus: num(item.httpStatus),
    https: typeof item.https === "boolean" ? item.https : null,
    loadTimeSeconds: num(item.loadTimeSeconds),
    title: str(item.title),
    titleLength: num(item.titleLength),
    metaDescriptionLength: num(item.metaDescriptionLength),
    h1Texts: Array.isArray(item.h1Texts) ? item.h1Texts.filter((t): t is string => typeof t === "string").slice(0, 5) : [],
    imagesTotal: num(images.total),
    imagesMissingAlt: num(images.missingAlt),
    hasLangAttr: typeof item.hasLangAttr === "boolean" ? item.hasLangAttr : null,
    viewport: str(item.viewport),
    vendorIssues: issues,
  };
  const findings: LaunchCheckFinding[] = issues.length
    ? [{
        id: "f_vendor_audit_issues",
        ruleId: "vendor_audit_issues",
        checkId: "html_audit",
        severity: "fyi",
        title: `The second-opinion service listed ${issues.length} issue${issues.length === 1 ? "" : "s"}`,
        observed: issues.join("; "),
        evidenceIds: [evidenceId],
        explanation: "These items come from an independent static HTML analysis and are quoted as the service reported them.",
        fix: "Review each listed item in your page source.",
        explainedBy: "template",
      }]
    : [];
  return { fields, findings };
}

export type ReceiptStatus = "paid" | "failed_not_charged" | "failed_charged" | "payment_unknown" | "refused_by_kite";

const REFUSED = new Set(["wallet_empty", "allowance_unavailable", "allowance_disabled", "allowance_cancelled", "recurring_budget_exhausted", "allowance_too_small", "session_total_exceeded", "separate_session_used_up", "insufficient_balance", "payment_cap_exceeded", "session_rule_exceeded", "merchant_not_allowed"]);

/** Receipt line status from a kpass execute outcome (exit codes from the x402-execute skill). */
export function receiptStatusFor(r: { exitCode: number; ok: boolean; merchantStatus: number | null; errorCode: string | null }): ReceiptStatus {
  if (r.exitCode === 7 || r.errorCode === "payment_outcome_pending" || r.errorCode === "recurring_payment_unknown") return "payment_unknown";
  if (r.errorCode === "payment_settled_unfulfilled") return "failed_charged";
  if (r.errorCode && REFUSED.has(r.errorCode)) return "refused_by_kite";
  if (r.exitCode === 0 && r.ok) return r.merchantStatus !== null && r.merchantStatus >= 200 && r.merchantStatus < 300 ? "paid" : "failed_charged";
  // Usage/authentication failures precede payment. A transport failure or killed CLI may happen after settlement.
  if (r.exitCode === 2 || r.exitCode === 3) return "failed_not_charged";
  return "payment_unknown";
}
