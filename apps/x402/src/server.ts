// Adapted from gokite-ai/kite-x402-services (templates/typescript-express), Apache-2.0.
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import express, { type Express, type Request, type Response } from "express";
import { FACILITATOR_URL, kiteChainByName, kiteMoneyParser } from "./kite.js";

export interface AppOptions {
  /** Wallet that receives payments. */
  payTo: string;
  network: "mainnet" | "testnet";
  /** Base URL of the web app's internal endpoint, e.g. https://tendr.app/api/internal/report */
  upstreamUrl: string;
  priceUsd: string;
  internalSecret: string;
  facilitatorUrl?: string;
  description?: string;
  /** Tests only: skip the payment middleware to exercise the proxy. */
  paywall?: boolean;
  fetchImpl?: typeof fetch;
}

const NOTICE_ID = /^(?:\d{1,6}-\d{4}|[0-9a-f]{32})$/i;
const HOP_BY_HOP = new Set(["connection", "keep-alive", "transfer-encoding", "te", "trailer", "upgrade", "host", "content-length", "content-encoding"]);

export function createApp(opts: AppOptions): Express {
  const chain = kiteChainByName(opts.network);
  const price = opts.priceUsd.startsWith("$") ? opts.priceUsd : `$${opts.priceUsd}`;
  const upstream = opts.upstreamUrl.replace(/\/$/, "");
  const fetchImpl = opts.fetchImpl ?? fetch;

  const app = express();
  app.disable("x-powered-by");

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true, network: chain.network, asset: chain.assetSymbol, price });
  });

  if (opts.paywall !== false) {
    const facilitator = new HTTPFacilitatorClient({ url: opts.facilitatorUrl ?? FACILITATOR_URL });
    const resourceServer = new x402ResourceServer(facilitator).register(
      chain.network,
      new ExactEvmScheme().registerMoneyParser(kiteMoneyParser(chain)),
    );
    app.use(
      paymentMiddleware(
        {
          "/v1/*": {
            accepts: { scheme: "exact", price, network: chain.network, payTo: opts.payTo, maxTimeoutSeconds: 60 },
            description: opts.description ?? "Tendr: competition-restriction signals report for one public tender notice (SAM.gov or TED; verified reports only)",
            mimeType: "application/json",
          },
        },
        resourceServer,
      ),
    );
  }

  /** Paid route. Any upstream status >= 400 (incl. 409 "not sellable yet") is passed through, so the middleware never settles. */
  app.get("/v1/report/:noticeId", async (req: Request, res: Response) => {
    const noticeId = String(req.params.noticeId ?? "");
    if (!NOTICE_ID.test(noticeId)) {
      res.status(400).json({ error: "noticeId must be a SAM.gov notice id (32 hex characters) or a TED publication number, e.g. 722731-2026" });
      return;
    }
    let upstreamRes: globalThis.Response;
    try {
      upstreamRes = await fetchImpl(`${upstream}/${noticeId}`, { headers: { "x-internal-secret": opts.internalSecret, accept: "application/json" }, signal: AbortSignal.timeout(30_000) });
    } catch {
      res.status(502).json({ error: "upstream unreachable" });
      return;
    }
    res.status(upstreamRes.status);
    upstreamRes.headers.forEach((value, key) => {
      if (!HOP_BY_HOP.has(key)) res.setHeader(key, value);
    });
    res.send(Buffer.from(await upstreamRes.arrayBuffer()));
  });

  app.all("/v1/*path", (_req, res) => {
    res.status(404).json({ error: "unknown resource; use GET /v1/report/{noticeId}" });
  });

  return app;
}
