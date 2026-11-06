import { describe, expect, it } from "vitest";
import { buyResultFrom, findTxHash } from "@/lib/launchcheck/buyer";

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
