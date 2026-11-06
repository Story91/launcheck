import { describe, expect, it } from "vitest";
import { buyResultFrom, findTxHash, findSettlement, acceptablePaymentOffer } from "@/lib/launchcheck/buyer";

it("refuses changed prices, alternative higher offers, other assets and variable-price offers before payment", () => {
  const offer = { scheme: "exact", network: "eip155:8453", asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", amount: "5000" };
  expect(acceptablePaymentOffer({ accepts: [offer] },.005)).toBe(true);
  for (const bad of [{ ...offer, amount: "5001" }, { ...offer, scheme: "upto" }, { ...offer, network: "eip155:1" }, { ...offer, asset: "OTHER" }]) expect(acceptablePaymentOffer({ accepts: [offer,bad] },.005)).toBe(false);
  expect(acceptablePaymentOffer({ accepts: [] },.005)).toBe(false);
});

const activity = {
  status: "success",
  events: [
    { kind: "x402_payment", occurred_at: "2026-11-06T03:17:31Z", details: { transaction: { tx_hash: "0xnew", x402: { request_url: "https://web.cyberwarex.com/screenshot?url=https%3A%2F%2Facme.dev%2F&fullpage=false&width=1280" } } } },
    { kind: "x402_payment", occurred_at: "2026-11-06T03:10:00Z", details: { transaction: { tx_hash: "0xold", x402: { request_url: "https://web.cyberwarex.com/screenshot?url=https%3A%2F%2Facme.dev%2F&fullpage=false&width=1280" } } } },
  ],
};

describe("findTxHash", () => {
  it("returns the hash of the payment for this exact URL made after the call started", () => {
    expect(findTxHash(activity, "https://web.cyberwarex.com/screenshot?url=https%3A%2F%2Facme.dev%2F&fullpage=false&width=1280", new Date("2026-11-06T03:17:00Z"))).toBe("0xnew");
  });
  it("returns null when no payment for that URL happened after the call started", () => {
    expect(findTxHash(activity, "https://api.kadec0.xyz/v1/website-audit?url=x", new Date("2026-11-06T03:00:00Z"))).toBeNull();
    expect(findTxHash(activity, "https://web.cyberwarex.com/screenshot?url=https%3A%2F%2Facme.dev%2F&fullpage=false&width=1280", new Date("2026-11-06T03:20:00Z"))).toBeNull();
  });
});

describe("buyResultFrom", () => {
  it("passes the merchant body through and reads the error envelope", () => {
    const ok = buyResultFrom({ exitCode: 0, json: { status: "success", source: "allowance", user_message: "Paid", x402: { status_code: 200, parsed_response_body: { png_base64: "AA==" } }, payment: { payment_response: { reference: "0xref" } } } });
    expect(ok).toMatchObject({ exitCode: 0, ok: true, merchantStatus: 200, errorCode: null, txHash: "0xref", source: "allowance", body: { png_base64: "AA==" } });
    const refused = buyResultFrom({ exitCode: 6, json: { status: "error", error_code: "wallet_empty", user_message: "Top up" } });
    expect(refused).toMatchObject({ ok: false, errorCode: "wallet_empty", body: null, txHash: null });
    expect(buyResultFrom({ exitCode: 1, json: null })).toMatchObject({ ok: false, errorCode: null, merchantStatus: null });
  });
});


describe("confirmed settlement amounts", () => {
  const url = "https://web.cyberwarex.com/screenshot?url=https%3A%2F%2Facme.dev";
  const since = new Date("2026-11-06T03:00:00Z");
  const event = { kind: "x402_payment", status: "completed", occurred_at: "2026-11-06T03:00:02Z", details: { transaction: { chain_id: 8453, asset_symbol: "USDC", decimals: 6, amount_raw: "7000", tx_hash: `0x${"a".repeat(64)}`, session_type: "allowance", x402: { request_url: url } } } };
  it("uses the completed activity amount rather than the listed price", () => {
    expect(findSettlement({ events: [event] }, url, since)).toMatchObject({ paidUsd: .007, source: "allowance" });
  });
  it("refuses an ambiguous match and unrelated assets or failed transfers", () => {
    expect(findSettlement({ events: [event, event] }, url, since)).toBeNull();
    expect(findSettlement({ events: [{ ...event, status: "failed" }] }, url, since)).toBeNull();
    expect(findSettlement({ events: [{ ...event, details: { transaction: { ...event.details.transaction, asset_symbol: "OTHER" } } }] }, url, since)).toBeNull();
    expect(findSettlement({ events: [event] }, url + "x", since)).toBeNull();
  });
});
