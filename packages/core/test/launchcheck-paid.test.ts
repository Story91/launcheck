import { describe, expect, it } from "vitest";
import { PAID_CHECKS, buildPaidRequest, normalizeAudit, normalizeScreenshot, paidChecksForTier, receiptStatusFor } from "../src/launchcheck/paid";
import { findBannedWords } from "../src/launchcheck/wording";

describe("paid check registry", () => {
  it("only lists checks whose price was confirmed by a real purchase", () => {
    expect(PAID_CHECKS.map((c) => [c.checkId, c.priceUsd])).toEqual([
      ["browser_navigation", 0.01],
      ["render_desktop", 0.005],
      ["render_narrow", 0.005],
      ["html_audit", 0.08],
    ]);
  });
  it("picks checks per tier", () => {
    expect(paidChecksForTier("quick").map((c) => c.checkId)).toEqual(["render_desktop", "render_narrow"]);
    expect(paidChecksForTier("standard").map((c) => c.checkId)).toEqual(["render_desktop", "render_narrow", "html_audit"]);
  });
});

describe("buildPaidRequest", () => {
  it("builds the cyberwarex screenshot calls with the ad block turned off", () => {
    expect(buildPaidRequest("render_desktop", "https://acme.dev/")).toEqual({
      url: "https://web.cyberwarex.com/screenshot?url=https%3A%2F%2Facme.dev%2F&fullpage=false&width=1280",
      method: "GET",
      headers: { "X-No-Advert": "1" },
    });
    expect(buildPaidRequest("render_narrow", "https://acme.dev/").url).toBe("https://web.cyberwarex.com/screenshot?url=https%3A%2F%2Facme.dev%2F&fullpage=true&width=390");
  });
  it("builds the kadec0 audit call", () => {
    expect(buildPaidRequest("html_audit", "https://acme.dev/")).toEqual({ url: "https://api.kadec0.xyz/v1/website-audit?url=https%3A%2F%2Facme.dev%2F", method: "GET", headers: {} });
  });
});

describe("normalizeScreenshot", () => {
  it("returns the PNG bytes and drops advisory/next_step blocks", () => {
    const n = normalizeScreenshot({ png_base64: Buffer.from("PNGDATA").toString("base64"), mime: "image/png", width: 390, fullpage: true, advisory: "x", next_step: { price_usdc: 3 } });
    expect(n?.png.toString()).toBe("PNGDATA");
    expect(n?.fields).toEqual({ width: 390, fullpage: true });
  });
  it("returns null without an image", () => {
    expect(normalizeScreenshot({ error: "nope" })).toBeNull();
  });
});

describe("normalizeAudit", () => {
  const body = { count: 1, items: [{ url: "https://acme.dev", httpStatus: 200, https: true, loadTimeSeconds: 0.53, title: "Acme", titleLength: 4, metaDescriptionLength: 0, h1Texts: ["Ship"], headings: { h1: 1 }, images: { total: 3, missingAlt: 2 }, hasLangAttr: true, viewport: null, issues: ["Missing meta description", "2 images without alt"], score: 72 }] };
  it("keeps the vendor fields, removes the score and turns vendor issues into one FYI finding", () => {
    const n = normalizeAudit(body, "ev_audit");
    expect(n).not.toBeNull();
    expect(n!.fields).not.toHaveProperty("score");
    expect(n!.fields).toMatchObject({ loadTimeSeconds: 0.53, titleLength: 4, imagesMissingAlt: 2, vendorIssues: ["Missing meta description", "2 images without alt"] });
    expect(n!.findings).toHaveLength(1);
    expect(n!.findings[0]).toMatchObject({ ruleId: "vendor_audit_issues", severity: "fyi", evidenceIds: ["ev_audit"], checkId: "html_audit" });
    const text = n!.findings.flatMap((f) => [f.title, f.observed, f.explanation, f.fix]).join(" ");
    expect(findBannedWords(text)).toEqual([]);
  });
  it("reports nothing found when the vendor lists no issues", () => {
    expect(normalizeAudit({ items: [{ ...body.items[0], issues: [] }] }, "ev_audit")!.findings).toEqual([]);
  });
});

describe("receiptStatusFor", () => {
  it("maps kpass outcomes to receipt statuses honestly", () => {
    expect(receiptStatusFor({ exitCode: 0, ok: true, merchantStatus: 200, errorCode: null })).toBe("paid");
    expect(receiptStatusFor({ exitCode: 1, ok: false, merchantStatus: null, errorCode: "payment_settled_unfulfilled" })).toBe("failed_charged");
    expect(receiptStatusFor({ exitCode: 0, ok: true, merchantStatus: 500, errorCode: null })).toBe("failed_charged");
    expect(receiptStatusFor({ exitCode: 6, ok: false, merchantStatus: null, errorCode: "wallet_empty" })).toBe("refused_by_kite");
    expect(receiptStatusFor({ exitCode: 6, ok: false, merchantStatus: null, errorCode: "recurring_budget_exhausted" })).toBe("refused_by_kite");
    expect(receiptStatusFor({ exitCode: 7, ok: false, merchantStatus: null, errorCode: "payment_outcome_pending" })).toBe("payment_unknown");
    expect(receiptStatusFor({ exitCode: 2, ok: false, merchantStatus: null, errorCode: "route_unavailable" })).toBe("failed_not_charged");
    expect(receiptStatusFor({ exitCode: 1, ok: false, merchantStatus: null, errorCode: "provider_unavailable" })).toBe("payment_unknown");
  });
});
