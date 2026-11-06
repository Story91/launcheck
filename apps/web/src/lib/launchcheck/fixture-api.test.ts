vi.mock("server-only", () => ({}));
import { agentStatusSchema, catalogSchema, checkCreatedSchema, gallerySchema, launchCheckReportSchema } from "@tendr/core";
import { describe, expect, it, vi } from "vitest";
import { GET as getAgent } from "@/app/api/agent/route";
import { GET as getCatalog } from "@/app/api/catalog/route";
import { GET as getCheck } from "@/app/api/checks/[id]/route";
import { POST as rerun } from "@/app/api/checks/[id]/rerun/route";
import { POST as createCheck } from "@/app/api/checks/route";
import { GET as getGallery } from "@/app/api/gallery/route";

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const post = (body: unknown) => new Request("http://localhost/api/checks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("LaunCheck API in fixture mode", () => {
  it("serves fixture reports that match the contract", async () => {
    for (const id of ["fx_problems", "fx_clean", "fx_unreachable", "fx_fixed"]) {
      const res = await getCheck(new Request(`http://localhost/api/checks/${id}`), params(id));
      expect(res.status).toBe(200);
      expect(launchCheckReportSchema.safeParse(await res.json()).success).toBe(true);
    }
  });

  it("advances fx_running one phase per request until done", async () => {
    const statuses: string[] = [];
    for (let i = 0; i < 7; i++) {
      const res = await getCheck(new Request("http://localhost/api/checks/fx_running"), params("fx_running"));
      statuses.push(((await res.json()) as { status: string }).status);
    }
    expect(statuses.slice(0, 6)).toEqual(["queued", "prechecking", "planning", "buying", "explaining", "done"]);
    expect(statuses[6]).toBe("queued");
  });

  it("returns 404 for unknown ids", async () => {
    const res = await getCheck(new Request("http://localhost/api/checks/lc_nope"), params("lc_nope"));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });

  it("serves catalog, gallery and agent status", async () => {
    expect(catalogSchema.safeParse(await (await getCatalog()).json()).success).toBe(true);
    expect(gallerySchema.safeParse(await (await getGallery(new Request("http://localhost/api/gallery?fixture=1"))).json()).success).toBe(true);
    const fixtureAgent = await (await getAgent(new Request("http://localhost/api/agent?fixture=1"))).json();
    expect(agentStatusSchema.safeParse(fixtureAgent).success).toBe(true);
    const live = (await (await getAgent(new Request("http://localhost/api/agent"))).json()) as { liveRuns: boolean; executor: { online: boolean } };
    expect(agentStatusSchema.safeParse(live).success).toBe(true);
    expect(live.liveRuns).toBe(false);
    expect(live.executor.online).toBe(false);
  });

  it("rejects invalid URLs and pauses live runs until the executor is online", async () => {
    expect((await createCheck(post({ url: "not a url", tier: "standard", venue: "x" }))).status).toBe(400);
    expect((await createCheck(post({ url: "ftp://example.com", tier: "standard", venue: "x" }))).status).toBe(400);
    const paused = await createCheck(post({ url: "https://example.com", tier: "standard", venue: "x" }));
    expect(paused.status).toBe(503);
    expect(await paused.json()).toEqual({ error: "live_runs_paused", reason: "executor_offline", galleryUrl: "/gallery" });
  });

  it("reruns the problems fixture into the fixed fixture", async () => {
    const res = await rerun(new Request("http://localhost/api/checks/fx_problems/rerun", { method: "POST" }), params("fx_problems"));
    expect(res.status).toBe(201);
    const body = checkCreatedSchema.parse(await res.json());
    expect(body.id).toBe("fx_fixed");
  });
});
