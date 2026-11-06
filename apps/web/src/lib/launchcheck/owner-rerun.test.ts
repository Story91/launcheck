import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRunStore } from "./run-store";
import { launchCheckFixtureReport } from "@tendr/core";
import { sha256, executeRun, liveRunsEnabled } from "./executor";
import { isRunOwner } from "./owner";
let store: MemoryRunStore;
vi.mock("./run-store", async original => ({ ...await original<typeof import("./run-store")>(), runStore: () => store }));
vi.mock("./executor", async original => ({ ...await original<typeof import("./executor")>(), executeRun: vi.fn(async () => {}), liveRunsEnabled: vi.fn(() => true) }));
vi.mock("./free-runtime", () => ({ assertPublicUrlLive: vi.fn(async () => {}) }));
vi.mock("next/server", async original => ({ ...await original<typeof import("next/server")>(), after: (fn: () => unknown) => fn() }));
const { POST: rerun } = await import("@/app/api/checks/[id]/rerun/route");
const { POST: create } = await import("@/app/api/checks/route");
const token = "x".repeat(32);
beforeEach(async () => {
  store = new MemoryRunStore(); vi.mocked(liveRunsEnabled).mockReturnValue(true);
  const parent = launchCheckFixtureReport("fx_problems"); parent.id = "lc_parent";
  await store.createRun(parent, { ipHash: "old", creatorHash: sha256(token) });
});
afterEach(() => vi.clearAllMocks());
describe("run ownership and rerun", () => {
  it("denies a non-owner before scheduling paid work", async () => {
    const res = await rerun(new Request("https://launch.example/api/checks/lc_parent/rerun", { method: "POST" }), { params: Promise.resolve({ id: "lc_parent" }) });
    expect(res.status).toBe(403); expect(executeRun).not.toHaveBeenCalled();
  });
  it("keeps the parent relation and creator identity on the follow-up run", async () => {
    const req = new Request("https://launch.example/api/checks/lc_parent/rerun", { method: "POST", headers: { cookie: `lc_creator=${token}` } });
    const res = await rerun(req, { params: Promise.resolve({ id: "lc_parent" }) }); const body = await res.json();
    expect(res.status).toBe(201); expect((await store.getReport(body.id))?.parentId).toBe("lc_parent");
    expect(await store.creatorHash(body.id)).toBe(sha256(token)); expect(executeRun).toHaveBeenCalledWith(body.id, "https://example.com/", "standard", "lc_parent");
  });
  it("does not replace the creator cookie when another report is created", async () => {
    const req = new Request("https://launch.example/api/checks", { method: "POST", headers: { cookie: `lc_creator=${token}`, "content-type": "application/json" }, body: JSON.stringify({ url: "https://other.example/", tier: "quick" }) });
    const response = await create(req);
    expect(response.status).toBe(201); expect(response.headers.get("set-cookie")).toContain(`lc_creator=${token};`);
    expect(await isRunOwner(req,"lc_parent")).toBe(true);
  });
});
