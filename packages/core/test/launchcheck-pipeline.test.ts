import { describe, expect, it } from "vitest";
import type { FreeChecksResult } from "../src/launchcheck/engine";
import { runLaunchCheck, type BuyResult, type LaunchCheckPipelineDeps } from "../src/launchcheck/pipeline";
import { launchCheckReportSchema, type LaunchCheckReport } from "../src/launchcheck/types";

const NOW = () => new Date("2026-11-06T12:00:00Z");
const pngBody = { png_base64: Buffer.from("PNG").toString("base64"), width: 1280, fullpage: false };
const auditBody = { items: [{ httpStatus: 200, https: true, loadTimeSeconds: 0.4, title: "Acme", titleLength: 4, issues: [] }] };

const freeOk: FreeChecksResult = {
  unreachable: false,
  error: null,
  finalUrl: "https://acme.dev/",
  linksFound: 12,
  blockedLinks: [],
  outcomes: [{
    check: { checkId: "share_tags", label: "Link preview tags", kind: "free", state: "problem", notCheckedReason: null, evidenceIds: ["ev_share_tags"], scopeNote: "Static HTML only" },
    evidence: [{ id: "ev_share_tags", checkId: "share_tags", kind: "json", label: "Link preview tags", blobUrl: null, sha256: "x", capturedAt: NOW().toISOString(), source: { type: "free", vendorHost: null, endpoint: null }, scopeNote: null, fields: {} }],
    findings: [{ id: "f_og_image_missing", ruleId: "og_image_missing", checkId: "share_tags", severity: "fix_before_launch", title: "Link preview has no image", observed: "No og:image tag", evidenceIds: ["ev_share_tags"], explanation: "x", fix: "y", explainedBy: "template" }],
  }],
};

function deps(over: Partial<LaunchCheckPipelineDeps> & { buys?: BuyResult[] } = {}) {
  const saved: LaunchCheckReport[] = [];
  const bought: string[] = [];
  const buys = [...(over.buys ?? [])];
  const d: LaunchCheckPipelineDeps = {
    runFree: async () => freeOk,
    buyer: async (req) => {
      bought.push(req.url);
      const next = buys.shift();
      if (next) return next;
      const body = req.url.includes("kadec0") ? auditBody : pngBody;
      return { exitCode: 0, ok: true, merchantStatus: 200, errorCode: null, userMessage: "Paid", body, txHash: "0xabc", source: "allowance" };
    },
    saveImage: async (id) => `/api/evidence/${id}.png`,
    save: async (r) => void saved.push(structuredClone(r)),
    canSpend: async () => true,
    idempotencyKey: (checkId) => `key-${checkId}`,
    now: NOW,
    agent: { kiteAgentId: "…d523", agentType: "claude", ownerMasked: "co***@…" },
    ...over,
  };
  return { d, saved, bought };
}

const input = { id: "lc_test", url: "https://acme.dev/", tier: "standard" as const, budgetUsd: 0.15 };

describe("runLaunchCheck", () => {
  it("runs free checks, buys the planned checks and returns a contract-valid report with a receipt", async () => {
    const { d, saved, bought } = deps();
    const r = await runLaunchCheck(input, d);
    expect(launchCheckReportSchema.safeParse(r).success).toBe(true);
    expect(r.status).toBe("done");
    expect(bought).toHaveLength(3);
    expect(r.receipt.lines.map((l) => [l.checkId, l.status, l.paidUsd])).toEqual([["render_desktop", "paid", 0.005], ["render_narrow", "paid", 0.005], ["html_audit", "paid", 0.08]]);
    expect(r.receipt.lines[0]!.explorerUrl).toBe("https://basescan.org/tx/0xabc");
    expect(r.spentUsd).toBeCloseTo(0.09, 6);
    expect(r.evidence.find((e) => e.checkId === "render_desktop")?.blobUrl).toBe("/api/evidence/ev_render_desktop.png");
    expect(r.summary).toMatchObject({ problems: 1, notChecked: 0 });
    expect(saved.map((s) => s.status)).toEqual(expect.arrayContaining(["prechecking", "planning", "buying", "done"]));
    for (const s of saved) expect(launchCheckReportSchema.safeParse(s).success).toBe(true);
  });

  it("never plans past the budget", async () => {
    const { d, bought } = deps();
    const r = await runLaunchCheck({ ...input, tier: "standard", budgetUsd: 0.05 }, d);
    expect(bought).toHaveLength(2);
    expect(r.plan?.skip.map((s) => s.checkId)).toEqual(["html_audit"]);
    expect(r.checks.find((c) => c.checkId === "html_audit")).toMatchObject({ state: "not_checked", notCheckedReason: "over_budget" });
  });

  it("stops buying when Kite refuses and marks what was not bought", async () => {
    const { d, bought } = deps({ buys: [{ exitCode: 6, ok: false, merchantStatus: null, errorCode: "wallet_empty", userMessage: "Top up", body: null, txHash: null, source: null }] });
    const r = await runLaunchCheck(input, d);
    expect(bought).toHaveLength(1);
    expect(r.receipt.stoppedBy).toBe("allowance_empty");
    expect(r.receipt.lines.map((l) => l.status)).toEqual(["refused_by_kite", "skipped_budget", "skipped_budget"]);
    expect(r.spentUsd).toBe(0);
    expect(r.checks.find((c) => c.checkId === "render_desktop")).toMatchObject({ state: "not_checked", notCheckedReason: "kite_refused" });
  });

  it("stops at our daily cap without calling Kite", async () => {
    const { d, bought } = deps({ canSpend: async () => false });
    const r = await runLaunchCheck(input, d);
    expect(bought).toHaveLength(0);
    expect(r.receipt.stoppedBy).toBe("our_cap");
  });

  it("records a vendor failure honestly (charged, no data)", async () => {
    const { d } = deps({ buys: [{ exitCode: 1, ok: false, merchantStatus: null, errorCode: "payment_settled_unfulfilled", userMessage: null, body: null, txHash: "0xdef", source: "allowance" }] });
    const r = await runLaunchCheck(input, d);
    const line = r.receipt.lines[0]!;
    expect(line).toMatchObject({ status: "failed_charged", paidUsd: 0.005 });
    expect(r.checks.find((c) => c.checkId === "render_desktop")).toMatchObject({ state: "not_checked", notCheckedReason: "vendor_error" });
  });

  it("ends an unreachable site at $0 without buying anything", async () => {
    const { d, bought } = deps({ runFree: async () => ({ unreachable: true, error: "DNS lookup failed", finalUrl: null, outcomes: [], blockedLinks: [], linksFound: 0 }) });
    const r = await runLaunchCheck(input, d);
    expect(r.status).toBe("unreachable");
    expect(bought).toHaveLength(0);
    expect(r.spentUsd).toBe(0);
    expect(launchCheckReportSchema.safeParse(r).success).toBe(true);
  });
});
