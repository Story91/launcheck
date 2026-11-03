import { createApp } from "./app.js";

const env = (key: string, fallback = ""): string => (process.env[key] ?? "").trim() || fallback;

function required(key: string): string {
  const v = env(key);
  if (!v) throw new Error(`${key} is required`);
  return v;
}

const network = env("KITE_NETWORK", "testnet");
if (network !== "mainnet" && network !== "testnet") throw new Error(`KITE_NETWORK must be mainnet or testnet, got "${network}"`);

const app = createApp({
  payTo: required("PAY_TO"),
  network,
  upstreamUrl: required("UPSTREAM_URL"),
  priceUsd: env("PRICE_USD", "0.50"),
  internalSecret: required("INTERNAL_SECRET"),
  facilitatorUrl: env("FACILITATOR_URL") || undefined,
});

const port = Number(env("PORT", "8080"));
app.listen(port, () => {
  console.log(`tenderhound x402 on :${port} -> ${env("UPSTREAM_URL")} (${network}, ${env("PRICE_USD", "0.50")} USD per report to ${env("PAY_TO")})`);
});
