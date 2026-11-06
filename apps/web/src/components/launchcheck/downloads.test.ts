import { afterEach, describe, expect, it, vi } from "vitest";
import { evidenceExport, exportFilename, receiptPng } from "./downloads";
import { fixtureReport } from "./mocks/fixtures";
afterEach(() => vi.unstubAllGlobals());
describe("receipt exports", () => {
  it("preserves evidence, scope and payment uncertainty without ownership controls", () => {
    const report = fixtureReport("fx_problems"); report.receipt.lines[0].status = "payment_unknown";
    const output = JSON.parse(evidenceExport(report, "https://launch.example/check/lc_one"));
    expect(output.report.receipt.lines[0].status).toBe("payment_unknown");
    expect(output.report.evidence).toEqual(report.evidence);
    expect(output.report.notChecked).toEqual(report.notChecked);
    expect(output.report).not.toHaveProperty("isRequester");
  });
  it("labels examples and produces filenames without path separators", () => {
    expect(exportFilename("fx_fixed", "png")).toBe("launcheck-example-fx_fixed.png");
    expect(exportFilename("../../x", "json")).not.toContain("/");
  });
  it("rejects an unavailable image rather than downloading an error page", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 })));
    await expect(receiptPng("lc_one")).rejects.toThrow();
  });
  it("downloads the existing OG artifact without starting another check", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(new Uint8Array([137,80,78,71]), { headers: { "content-type": "image/png" } }));
    vi.stubGlobal("fetch", fetch); expect((await receiptPng("fx_fixed")).size).toBe(4);
    expect(fetch.mock.calls[0][0]).toBe("/check/fx_fixed/opengraph-image");
    expect(fetch.mock.calls[0][1]).not.toHaveProperty("method", "POST");
  });
});
