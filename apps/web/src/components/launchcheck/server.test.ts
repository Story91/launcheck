import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/launchcheck/run-store", () => ({ runStore: () => ({ getReport: get }) }));
const { get } = vi.hoisted(() => ({ get: vi.fn() }));
import { getPublicReport } from "./server";
import { fixtureReport } from "./mocks/fixtures";
afterEach(() => vi.clearAllMocks());
describe("public report loader", () => {
  it("loads this deployment's report without fetching another host or exposing ownership", async () => {
    const report = fixtureReport("fx_problems"); report.id = "lc_real"; report.isRequester = true;
    get.mockResolvedValue(report);
    const result = await getPublicReport("lc_real");
    expect(get).toHaveBeenCalledWith("lc_real");
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") expect(result.report.isRequester).toBe(false);
  });
  it("distinguishes a removed report from storage failure", async () => {
    get.mockResolvedValueOnce(null); expect((await getPublicReport("lc_removed")).kind).toBe("missing");
    get.mockRejectedValueOnce(new Error("DB unavailable")); expect((await getPublicReport("lc_retry")).kind).toBe("unavailable");
  });
  it("does not present malformed stored data as a report", async () => {
    get.mockResolvedValue({ id: "lc_bad" }); expect((await getPublicReport("lc_bad")).kind).toBe("unavailable");
  });
});
