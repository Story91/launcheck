import type { BuyResult, PaidRequest } from "@tendr/core";
import { runKpass, type KpassResult } from "@/lib/launchcheck/kpass-runtime";

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {});

/** kpass `session execute` envelope → BuyResult (merchant body passed through as untrusted data). */
export function buyResultFrom(r: KpassResult): BuyResult {
  const j = obj(r.json), x402 = obj(j.x402);
  const ref = obj(obj(j.payment).payment_response).reference;
  return {
    exitCode: r.exitCode,
    ok: j.status === "success",
    merchantStatus: typeof x402.status_code === "number" ? x402.status_code : null,
    errorCode: typeof j.error_code === "string" ? j.error_code : null,
    userMessage: typeof j.user_message === "string" ? j.user_message : null,
    body: x402.parsed_response_body ?? null,
    txHash: typeof ref === "string" && ref ? ref : null,
    source: typeof j.source === "string" ? j.source : null,
  };
}

/** The on-chain hash of the x402 payment for `url` made at or after `since`, from `kpass activity`. */
export function findTxHash(activity: unknown, url: string, since: Date): string | null {
  const events = obj(activity).events;
  if (!Array.isArray(events)) return null;
  for (const e of events) {
    const ev = obj(e), tx = obj(obj(ev.details).transaction), x402 = obj(tx.x402);
    const at = Date.parse(String(ev.occurred_at ?? ""));
    if (ev.kind === "x402_payment" && x402.request_url === url && at >= since.getTime() - 5_000 && typeof tx.tx_hash === "string") return tx.tx_hash;
  }
  return null;
}

/** Buys one paid check through Kite Passport from this function (allowance), then looks up the settlement hash. */
export async function kpassBuy(req: PaidRequest & { idempotencyKey: string }): Promise<BuyResult> {
  const started = new Date();
  const args = ["session", "execute", "--url", req.url, "--method", req.method, "--idempotency-key", req.idempotencyKey, "--no-browser"];
  if (Object.keys(req.headers).length) args.push("--headers", JSON.stringify(req.headers));
  const result = buyResultFrom(await runKpass(args, 290_000));
  if (!result.txHash && (result.ok || result.errorCode === "payment_settled_unfulfilled")) {
    try {
      const activity = await runKpass(["activity", "--kind", "x402_payment", "--limit", "10"], 30_000);
      result.txHash = findTxHash(activity.json, req.url, started);
    } catch {
      /* the receipt shows "no transaction hash" rather than failing the run */
    }
  }
  return result;
}
