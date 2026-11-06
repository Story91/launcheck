import { launchCheckReportSchema } from "@tendr/core";
import type { FreeChecksResult } from "@tendr/core/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRunStore } from "@/lib/launchcheck/run-store";

// Route handlers with every external effect replaced: no network, no Kite, no database.
const store = new MemoryRunStore();
const tasks: Promise<unknown>[] = [];
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: (fn: () => Promise<unknown>) => void tasks.push(fn()) }));
vi.mock("@/lib/launchcheck/run-store", async (orig) => ({ ...(await orig<typeof import("@/lib/launchcheck/run-store")>()), runStore: () => store }));
vi.mock("@/lib/launchcheck/buyer", () => ({
  kpassBuy: vi.fn(async (req: { url: string }) => ({ exitCode: 0, ok: true, merchantStatus: 200, errorCode: null, userMessage: "Paid", body: req.url.includes("kadec0") ? { items: [{ httpStatus: 200, issues: [] }] } : { png_base64: "UE5H", width: 1280 }, txHash: "0xabc", source: "allowance" })),
}));
const free: FreeChecksResult = { unreachable: false, error: null, finalUrl: "https://acme.dev/", outcomes: [], blockedLinks: [], linksFound: 0 };
vi.mock("@/lib/launchcheck/free-runtime", () => ({
  runFreeChecksLive: vi.fn(async () => free),
  assertPublicUrlLive: vi.fn(async (url: string) => {
    if (url.includes("127.0.0.1")) {
      const { BlockedUrlError } = await import("@tendr/core/server");
      throw new BlockedUrlError("private_address");
    }
  }),
}));

const { POST } = await import("@/app/api/checks/route");
const { GET, DELETE } = await import("@/app/api/checks/[id]/route");
const post = (body: unknown, ip = "1.2.3.4") => new Request("http://localhost/api/checks", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(body) });
const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe("POST /api/checks (live)", () => {
  beforeEach(() => {
    process.env.LAUNCHCHECK_LIVE = "1";
    process.env.LAUNCHCHECK_DAILY_CAP_USD = "1.5";
    process.env.KPASS_CONFIG_JSON_B64 = Buffer.from("{}").toString("base64");
    process.env.KPASS_AGENT_JSON_B64 = Buffer.from("{}").toString("base64");
    process.env.KPASS_SESSIONS_JSON_B64 = Buffer.from("{}").toString("base64");
  });
  afterEach(() => {
    delete process.env.LAUNCHCHECK_LIVE;
  });

  it("starts a run, finishes it in the background and serves the report with the requester flag", async () => {
    const res = await POST(post({ url: "https://acme.dev", tier: "standard", venue: "x" }));
    expect(res.status).toBe(201);
    const { id, reportUrl } = (await res.json()) as { id: string; reportUrl: string };
    expect(id).toMatch(/^lc_[A-Za-z0-9]{10,}$/);
    expect(reportUrl).toBe(`/check/${id}`);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/lc_creator=/);
    await Promise.all(tasks);
    const got = await GET(new Request(`http://localhost/api/checks/${id}`, { headers: { cookie: cookie.split(";")[0]! } }), params(id));
    const report = launchCheckReportSchema.parse(await got.json());
    expect(report.status).toBe("done");
    expect(report.isRequester).toBe(true);
    expect(report.receipt.lines).toHaveLength(3);
    const anon = launchCheckReportSchema.parse(await (await GET(new Request(`http://localhost/api/checks/${id}`), params(id))).json());
    expect(anon.isRequester).toBe(false);
  });

  it("serves a recent finished run for the same site instead of buying again", async () => {
    const res = await POST(post({ url: "https://acme.dev/", tier: "standard", venue: "x" }, "9.9.9.9"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ cached: true });
  });

  it("blocks private addresses, rejects bad input, rate limits per IP and pauses when live runs are off", async () => {
    expect((await POST(post({ url: "http://127.0.0.1/", tier: "quick" }))).status).toBe(403);
    expect((await POST(post({ url: "nope", tier: "quick" }))).status).toBe(400);
    expect((await POST(post({ url: "https://a.dev", tier: "mega" }))).status).toBe(400);
    for (let i = 0; i < 3; i++) await POST(post({ url: `https://site${i}.dev`, tier: "quick" }, "5.5.5.5"));
    const limited = await POST(post({ url: "https://site9.dev", tier: "quick" }, "5.5.5.5"));
    expect(limited.status).toBe(429);
    delete process.env.LAUNCHCHECK_LIVE;
    const paused = await POST(post({ url: "https://new.dev", tier: "quick" }, "6.6.6.6"));
    expect(paused.status).toBe(503);
    expect(await paused.json()).toMatchObject({ error: "live_runs_paused", reason: "paused" });
  });

  it("lets only the requester delete a run", async () => {
    const res = await POST(post({ url: "https://delete.dev", tier: "quick" }, "7.7.7.7"));
    const { id } = (await res.json()) as { id: string };
    const cookie = (res.headers.get("set-cookie") ?? "").split(";")[0]!;
    expect((await DELETE(new Request(`http://localhost/api/checks/${id}`, { method: "DELETE" }), params(id))).status).toBe(403);
    expect((await DELETE(new Request(`http://localhost/api/checks/${id}`, { method: "DELETE", headers: { cookie } }), params(id))).status).toBe(204);
  });
});
