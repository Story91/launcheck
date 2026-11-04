import { describe, expect, it } from "vitest";
import { resolveConfig } from "../src/config";

const full = {
  PAY_TO: "0x000000000000000000000000000000000000dEaD",
  INTERNAL_SECRET: "s",
  KITE_NETWORK: "testnet",
  UPSTREAM_URL: "https://web.example/api/internal/report",
  PRICE_USD: "0.50",
};

describe("resolveConfig", () => {
  it("uses UPSTREAM_URL when given", () => {
    const r = resolveConfig(full);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.options.upstreamUrl).toBe("https://web.example/api/internal/report");
  });

  it("derives the upstream from the Vercel service binding when UPSTREAM_URL is absent", () => {
    const { UPSTREAM_URL: _u, ...env } = full;
    const r = resolveConfig({ ...env, WEB_INTERNAL_URL: "https://web-internal.vercel.app" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.options.upstreamUrl).toBe("https://web-internal.vercel.app/api/internal/report");
  });

  it("reports every missing variable instead of throwing", () => {
    const r = resolveConfig({ KITE_NETWORK: "testnet" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.missing).toEqual(["PAY_TO", "INTERNAL_SECRET", "UPSTREAM_URL or WEB_INTERNAL_URL"]);
  });

  it("rejects an unknown network", () => {
    const r = resolveConfig({ ...full, KITE_NETWORK: "devnet" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.missing).toContain("KITE_NETWORK (mainnet|testnet)");
  });

  it("defaults network to testnet and price to 0.50", () => {
    const { KITE_NETWORK: _n, PRICE_USD: _p, ...env } = full;
    const r = resolveConfig(env);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.options).toMatchObject({ network: "testnet", priceUsd: "0.50" });
  });
});
