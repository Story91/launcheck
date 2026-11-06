import request from "supertest";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/server";

const base = {
  payTo: "0x000000000000000000000000000000000000dEaD",
  network: "testnet" as const,
  upstreamUrl: "https://web.example/api/internal/report",
  priceUsd: "0.50",
  internalSecret: "s3cret",
};

beforeEach(() => {
  vi.spyOn(HTTPFacilitatorClient.prototype, "getSupported").mockResolvedValue({
    kinds: [{ x402Version: 2, scheme: "exact", network: "eip155:2368" }],
    extensions: [], signers: {},
  });
});
afterEach(() => vi.restoreAllMocks());

describe("paywall", () => {
  it("answers 402 with payment terms when no payment is attached", async () => {
    const app = createApp(base);
    const res = await request(app).get("/v1/report/722731-2026");
    expect(res.status).toBe(402);
    expect(res.headers["payment-required"]).toBeDefined();
    const terms = JSON.parse(Buffer.from(String(res.headers["payment-required"]), "base64").toString("utf8"));
    expect(terms.accepts[0]).toMatchObject({ scheme: "exact", network: "eip155:2368", payTo: base.payTo });
    expect(terms.accepts[0].amount).toBe((0.5e18).toString());
  });

  it("serves /healthz without payment", async () => {
    const res = await request(createApp(base)).get("/healthz");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, network: "eip155:2368", asset: "pieUSD" });
  });
});

describe("report proxy", () => {
  it("proxies SAM.gov identifiers as well as TED publication numbers", async () => {
    const id = "0123456789abcdef0123456789abcdef";
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({ noticeId: id }));
    const res = await request(createApp({ ...base, paywall: false, fetchImpl })).get(`/v1/report/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.noticeId).toBe(id);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`${base.upstreamUrl}/${id}`);
    expect(fetchImpl.mock.calls[0]?.[1].signal).toBeInstanceOf(AbortSignal);
  });

  it("does not expose internal connection details when the upstream fails", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("private database address"));
    const res = await request(createApp({ ...base, paywall: false, fetchImpl })).get('/v1/report/1-2026');
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: "upstream unreachable" });
  });
  const upstreamCalls: { url: string; secret: string | null }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    upstreamCalls.push({ url, secret: new Headers(init.headers).get("x-internal-secret") });
    if (url.endsWith("/1-2026")) return new Response(JSON.stringify({ status: "pending_verification", retryAfterSeconds: 60 }), { status: 409, headers: { "content-type": "application/json" } });
    if (url.endsWith("/722731-2026")) return new Response(JSON.stringify({ noticeId: "722731-2026", riskScore: 30 }), { status: 200, headers: { "content-type": "application/json" } });
    return new Response(JSON.stringify({ error: "report not found" }), { status: 404, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;

  it("proxies to the internal endpoint with the shared secret and passes 200 through", async () => {
    const app = createApp({ ...base, paywall: false, fetchImpl });
    const res = await request(app).get("/v1/report/722731-2026");
    expect(res.status).toBe(200);
    expect(res.body.riskScore).toBe(30);
    expect(upstreamCalls.at(-1)).toEqual({ url: "https://web.example/api/internal/report/722731-2026", secret: "s3cret" });
  });

  it("passes a 409 (not sellable yet) through unchanged so the middleware never settles", async () => {
    const res = await request(createApp({ ...base, paywall: false, fetchImpl })).get("/v1/report/1-2026");
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ status: "pending_verification", retryAfterSeconds: 60 });
  });

  it("rejects malformed notice ids with 400 before touching the upstream", async () => {
    const before = upstreamCalls.length;
    const res = await request(createApp({ ...base, paywall: false, fetchImpl })).get("/v1/report/not-a-notice");
    expect(res.status).toBe(400);
    expect(upstreamCalls.length).toBe(before);
  });
});
