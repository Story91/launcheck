import type { AppOptions } from "./app.js";

export type ResolvedConfig = { ok: true; options: AppOptions } | { ok: false; missing: string[] };

const env = (e: NodeJS.ProcessEnv, key: string, fallback = ""): string => (e[key] ?? "").trim() || fallback;

/**
 * Builds AppOptions from the environment without throwing, so a misconfigured deployment still boots and
 * reports what is missing on /healthz. The upstream comes from UPSTREAM_URL, or from the Vercel service binding
 * WEB_INTERNAL_URL (apps/web) when both apps deploy as one multi-service project.
 */
export function resolveConfig(e: NodeJS.ProcessEnv): ResolvedConfig {
  const missing: string[] = [];
  const payTo = env(e, "PAY_TO");
  if (!payTo) missing.push("PAY_TO");
  const internalSecret = env(e, "INTERNAL_SECRET");
  if (!internalSecret) missing.push("INTERNAL_SECRET");

  let upstreamUrl = env(e, "UPSTREAM_URL");
  if (!upstreamUrl && env(e, "WEB_INTERNAL_URL")) upstreamUrl = new URL("/api/internal/report", env(e, "WEB_INTERNAL_URL")).toString();
  if (!upstreamUrl) missing.push("UPSTREAM_URL or WEB_INTERNAL_URL");

  const network = env(e, "KITE_NETWORK", "testnet");
  if (network !== "mainnet" && network !== "testnet") missing.push("KITE_NETWORK (mainnet|testnet)");

  if (missing.length > 0) return { ok: false, missing };
  return {
    ok: true,
    options: {
      payTo,
      network: network as "mainnet" | "testnet",
      upstreamUrl,
      priceUsd: env(e, "PRICE_USD", "0.50"),
      internalSecret,
      facilitatorUrl: env(e, "FACILITATOR_URL") || undefined,
    },
  };
}
