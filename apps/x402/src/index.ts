import express from "express";
import { createApp } from "./server.js";
import { resolveConfig } from "./config.js";

const resolved = resolveConfig(process.env);

const app = resolved.ok
  ? createApp(resolved.options)
  : express()
      .get("/healthz", (_req, res) => res.status(503).json({ ok: false, missing: resolved.missing }))
      .all("/v1/*path", (_req, res) => res.status(503).json({ error: "x402 service not configured", missing: resolved.missing }));

if (!resolved.ok) console.error(`tendr x402 misconfigured, missing: ${resolved.missing.join(", ")}`);

const port = Number((process.env.PORT ?? "").trim() || "8080");
app.listen(port, () => {
  if (resolved.ok) {
    console.log(`tendr x402 on :${port} -> ${resolved.options.upstreamUrl} (${resolved.options.network}, ${resolved.options.priceUsd} USD per report to ${resolved.options.payTo})`);
  }
});
