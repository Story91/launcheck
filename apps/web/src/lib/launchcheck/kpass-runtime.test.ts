import { describe, expect, it } from "vitest";
import { kpassChildEnv, kpassFilesFromEnv, sanitizeAllowance, sanitizeExecute, sanitizeStatus } from "@/lib/launchcheck/kpass-runtime";

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64");

describe("kpassFilesFromEnv", () => {
  it("decodes the three credential files from base64 env vars", () => {
    const files = kpassFilesFromEnv({ KPASS_CONFIG_JSON_B64: b64({ a: 1 }), KPASS_AGENT_JSON_B64: b64({ b: 2 }), KPASS_SESSIONS_JSON_B64: b64({ c: 3 }) });
    expect(files).toEqual({ "config.json": '{"a":1}', "agent.json": '{"b":2}', "sessions.json": '{"c":3}' });
  });
  it("returns null when any file is missing or not JSON", () => {
    expect(kpassFilesFromEnv({ KPASS_CONFIG_JSON_B64: b64({}), KPASS_AGENT_JSON_B64: b64({}) })).toBeNull();
    expect(kpassFilesFromEnv({ KPASS_CONFIG_JSON_B64: b64({}), KPASS_AGENT_JSON_B64: b64({}), KPASS_SESSIONS_JSON_B64: Buffer.from("not json").toString("base64") })).toBeNull();
  });
});

describe("kpassChildEnv", () => {
  it("points every home variable at the temp root and turns off updates, browsers and prompts", () => {
    const env = kpassChildEnv("/tmp/kp", { PATH: "/usr/bin", SECRET_THING: "x" });
    expect(env).toMatchObject({ HOME: "/tmp/kp", USERPROFILE: "/tmp/kp", KPASS_HOME: "/tmp/kp", KPASS_NO_UPDATE_CHECK: "1", KPASS_AUTO_UPGRADE: "0", KPASS_NO_BROWSER: "1", CI: "1", PATH: "/usr/bin" });
    expect(env).not.toHaveProperty("SECRET_THING");
  });
});

describe("sanitizeStatus", () => {
  it("keeps only non-secret state and never echoes tokens", () => {
    const raw = {
      status: "success",
      hint: "Fully operational",
      backend: { reachable: true, status: "ok", url: "https://passport.prod.gokite.ai" },
      user: { email: "someone@example.com", logged_in: true, jwt_valid: true, user_id: "user_1", jwt: "eyJ.secret" },
      agent: { agent_id: "agent_01a1ae93-168a-789b-9d08-7b0a06f3d523", registered: true, type: "claude", token: "eyJ.agent" },
      session: { active: true, current_session_id: "agent_session_x", details: { private_key: "0xdead" } },
    };
    const s = sanitizeStatus(raw);
    expect(s).toEqual({ ok: true, backendReachable: true, backendUrl: "https://passport.prod.gokite.ai", loggedIn: true, jwtValid: true, agentRegistered: true, agentType: "claude", agentIdShort: "…d523", sessionActive: true, hint: "Fully operational" });
    expect(JSON.stringify(s)).not.toMatch(/eyJ|0xdead|someone@/);
  });
});

describe("sanitizeAllowance", () => {
  it("maps the allowance reply to the public meter fields", () => {
    expect(sanitizeAllowance({ amount: "10", left: "9.915", period: "weekly", reset_at: "2026-11-13T01:33:28Z", state: "active", spent: "0.085" }, "2026-11-06T12:00:00Z")).toEqual({
      limitUsd: 10, leftUsd: 9.915, period: "weekly", resetsAt: "2026-11-13T01:33:28Z", readAt: "2026-11-06T12:00:00Z", state: "active",
    });
    expect(sanitizeAllowance({ state: "none" }, "2026-11-06T12:00:00Z")).toBeNull();
  });
});

describe("sanitizeExecute", () => {
  it("keeps the receipt and the merchant result shape, drops the image body and secrets", () => {
    const raw = {
      status: "success",
      source: "allowance",
      user_message: "Paid USD 0.005 from your account allowance. Left this week: USD 9.91 of USD 10.",
      session_id: "agent_session_secret",
      payment: { payment_response: { reference: "0xabc123" }, amount: "5000", private_key: "0xdead" },
      x402: { status_code: 200, parsed_response_body: { png_base64: "iVBORw0KGgo=", mime: "image/png", width: 1280, next_step: { price_usdc: 3 } } },
    };
    const s = sanitizeExecute(raw);
    expect(s).toEqual({ ok: true, source: "allowance", userMessage: raw.user_message, merchantStatus: 200, txHash: "0xabc123", errorCode: null, pngBytes: 8, pngSha256: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(JSON.stringify(s)).not.toMatch(/iVBOR|0xdead|agent_session/);
  });
  it("reports the error code when the payment did not go through", () => {
    expect(sanitizeExecute({ status: "error", error_code: "wallet_empty", user_message: "Top up." })).toMatchObject({ ok: false, errorCode: "wallet_empty", txHash: null, pngBytes: null });
  });
});
