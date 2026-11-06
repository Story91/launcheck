import type { BuyResult, PaidRequest } from "@tendr/core/server";
import { PAID_CHECKS } from "@tendr/core/server";
import { runKpass, type KpassResult } from "@/lib/launchcheck/kpass-runtime";

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {});

/** Accept only exact Base USDC offers at or below the listed price. The owner allowance remains the settlement limit. */
export function acceptablePaymentOffer(value: unknown, quotedUsd: number): boolean {
  const accepts = obj(value).accepts;
  return Array.isArray(accepts) && accepts.length > 0 && accepts.every(value => {
    const a = obj(value), amount = a.amount ?? a.maxAmountRequired;
    return a.scheme === "exact" && (a.network === "eip155:8453" || a.network === "base") && typeof a.asset === "string" && a.asset.toLowerCase() === "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" && typeof amount === "string" && /^\d{1,15}$/.test(amount) && BigInt(amount) <= BigInt(Math.round(quotedUsd * 1e6));
  });
}

async function preflight(req: PaidRequest): Promise<boolean> {
  const target = new URL(req.url);
  const check = PAID_CHECKS.find(c => target.protocol === "https:" && target.hostname === c.vendorHost && target.pathname === c.endpoint && !target.port && !target.username && !target.password);
  if (!check) return false;
  const response = await fetch(req.url, { method: req.method, headers: req.headers, body: req.body === undefined ? undefined : JSON.stringify(req.body), redirect: "manual", signal: AbortSignal.timeout(12000) });
  if (response.status !== 402) { await response.body?.cancel(); return false; }
  const encoded = response.headers.get("payment-required");
  if (encoded && encoded.length < 65536) { await response.body?.cancel(); return acceptablePaymentOffer(JSON.parse(Buffer.from(encoded,"base64").toString("utf8")),check.priceUsd); }
  const reader = response.body?.getReader(); if (!reader) return false;
  let text = "";
  for (;;) { const part = await reader.read(); if (part.done) break; text += new TextDecoder().decode(part.value); if (text.length > 65536) { await reader.cancel(); return false; } }
  return acceptablePaymentOffer(JSON.parse(text),check.priceUsd);
}

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
    paidUsd: null,
  };
}

/** A completed Base USDC settlement for this invocation, never the catalogue's quoted price. */
export function findSettlement(activity: unknown, url: string, since: Date, hash?: string | null): { paidUsd: number; txHash: string; source: string | null } | null {
  const events = obj(activity).events;
  if (!Array.isArray(events)) return null;
  const matches = events.filter(e => {
    const ev = obj(e), tx = obj(obj(ev.details).transaction), x = obj(tx.x402);
    return ev.kind === "x402_payment" && ev.status === "completed" && x.request_url === url && Date.parse(String(ev.occurred_at ?? "")) >= since.getTime() - 5000 && tx.chain_id === 8453 && tx.asset_symbol === "USDC" && tx.decimals === 6 && typeof tx.amount_raw === "string" && /^\d{1,15}$/.test(tx.amount_raw) && typeof tx.tx_hash === "string" && /^0x[a-fA-F0-9]{64}$/.test(tx.tx_hash) && (!hash || !/^0x[a-fA-F0-9]{64}$/.test(hash) || tx.tx_hash === hash);
  });
  if (matches.length !== 1) return null;
  const tx = obj(obj(obj(matches[0]).details).transaction);
  return { paidUsd: Number(tx.amount_raw) / 1e6, txHash: String(tx.tx_hash), source: typeof tx.session_type === "string" ? tx.session_type : null };
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
  try {
    if (!await preflight(req)) return { exitCode: 2, ok: false, merchantStatus: null, errorCode: "price_preflight_failed", userMessage: "The current payment offer could not be confirmed at the listed price.", body: null, txHash: null, source: null, paidUsd: 0 };
  } catch { return { exitCode: 2, ok: false, merchantStatus: null, errorCode: "price_preflight_failed", userMessage: "Payment offer unavailable; no payment was attempted.", body: null, txHash: null, source: null, paidUsd: 0 }; }
  const started = new Date();
  const args = ["session", "execute", "--url", req.url, "--method", req.method, "--idempotency-key", req.idempotencyKey, "--no-browser"];
  if (Object.keys(req.headers).length) args.push("--headers", JSON.stringify(req.headers));
  if (req.body !== undefined) args.push("--body", JSON.stringify(req.body));
  const result = buyResultFrom(await runKpass(args, 290_000));
  if (result.ok || result.errorCode === "payment_settled_unfulfilled") {
    try {
      const activity = await runKpass(["activity", "--kind", "x402_payment", "--limit", "10"], 30_000);
      const settlement = findSettlement(activity.json, req.url, started, result.txHash);
      result.txHash = settlement?.txHash ?? result.txHash;
      result.paidUsd = settlement?.paidUsd ?? null;
      result.source = settlement?.source === "allowance" || settlement?.source === "session" ? settlement.source : result.source;
    } catch {
      /* the receipt shows "no transaction hash" rather than failing the run */
    }
  }
  return result;
}
