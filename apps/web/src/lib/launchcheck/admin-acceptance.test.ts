import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { MemoryRunStore } from "./run-store";
import { launchCheckFixtureReport } from "@tendr/core";
vi.mock("server-only", () => ({}));
let store: MemoryRunStore;
vi.mock("./run-store", async original => ({ ...await original<typeof import("./run-store")>(), runStore: () => store }));
vi.mock("./executor", async original => ({ ...await original<typeof import("./executor")>(), executorConfigured: () => true, executeRun: vi.fn(async () => {}) }));
vi.mock("next/server", async original => ({ ...await original<typeof import("next/server")>(), after: vi.fn() }));
const { POST: probe } = await import("@/app/api/admin/launchcheck-probe/route");
const { POST: settings } = await import("@/app/api/admin/launchcheck-demo/route");
const auth = "test-owner-secret";
beforeEach(() => { store = new MemoryRunStore(); vi.stubEnv("CRON_SECRET",auth); vi.stubEnv("SERV_API_KEY","unit-test-key"); vi.stubEnv("NEXT_PUBLIC_APP_URL","https://launch.example"); });
afterEach(() => vi.unstubAllEnvs());
const req = (path: string, body?: unknown, authenticated = true) => new Request(`https://launch.example${path}`, { method: "POST", headers: { ...(authenticated ? { authorization: `Bearer ${auth}` } : {}), "content-type": "application/json", "idempotency-key": "owner-acceptance-test-0001" }, body: JSON.stringify(body ?? {}) });
it("requires owner authentication before creating any run or changing the demo", async () => {
  expect((await probe(req("/probe",{},false))).status).toBe(401);
  expect((await settings(req("/settings",{fixed:true},false))).status).toBe(401);
  expect(await store.getSetting("demo_fixed")).toBeNull();
});
it("pins the paid acceptance target to our own demo and reuses the operation on retry", async () => {
  const first = await probe(req("/probe",{url:"https://third-party.example"})); const body = await first.json();
  expect(first.status).toBe(201);
  expect((await store.getReport(body.id))?.url).toBe("https://launch.example/demo/acme-launch");
  const retry = await probe(req("/probe")); expect(retry.status).toBe(200);
  expect(await retry.json()).toMatchObject({id:body.id,reused:true});
  expect(retry.headers.get("set-cookie")).toBe(first.headers.get("set-cookie"));
});
it("does not publish third-party reports or partially apply invalid settings", async () => {
  const report = launchCheckFixtureReport("fx_problems"); report.id="lc_external";
  await store.createRun(report,{ipHash:"x",creatorHash:"x"});
  const response = await settings(req("/settings",{fixed:true,featuredReportId:report.id}));
  expect(response.status).toBe(400); expect(await store.getSetting("demo_fixed")).toBeNull();
});
