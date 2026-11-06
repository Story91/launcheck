import { afterEach, describe, expect, it, vi } from "vitest";
import { createCheck, readReport } from "./api";
import { fixtureReport, fixtureIds } from "./mocks/fixtures";
import { reportSchema } from "./contract";
afterEach(() => vi.unstubAllGlobals());
describe("report boundary", () => {
  it.each(fixtureIds)("validates %s and reconciles known spending", id => { const report = reportSchema.parse(fixtureReport(id)); expect(report.receipt.lines.reduce((sum, line) => sum + line.paidUsd, 0)).toBeCloseTo(report.spentUsd); expect(report.spentUsd).toBeLessThanOrEqual(report.budgetUsd); });
  it("sends tier and venue without inventing a budget", async () => { const fetch = vi.fn().mockResolvedValue(Response.json({ id: "lc_test", cached: false, reportUrl: "/check/lc_test" }, { status: 201 })); vi.stubGlobal("fetch", fetch); await createCheck("https://example.com/", "standard", "x"); expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ url: "https://example.com/", tier: "standard", venue: "x" }); });
  it("reports a paused executor without falling back to a fake success", async () => { vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "live_runs_paused", reason: "executor_offline" }, { status: 503 }))); await expect(createCheck("https://example.com", "quick", "other")).rejects.toThrow("offline"); });
  it("rejects malformed paid results", async () => { const report = fixtureReport("fx_clean"); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ ...report, spentUsd: -1 }))); await expect(readReport("lc_real")).rejects.toThrow("unexpected report format"); });
  it("does not conflate no problems with complete coverage", () => { const report = fixtureReport("fx_clean"); expect(report.findings).toHaveLength(0); expect(report.checks.some(c => c.state === "not_checked")).toBe(true); expect(report.notChecked.length).toBeGreaterThan(0); });
});
