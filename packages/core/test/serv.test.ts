import { describe, expect, it } from "vitest";
import { z } from "zod";
import { makeAudit } from "../src/llm/audit";
import { DISABLE_CONTENT_FILTER, PROMPT_GUARD, shadowAgent } from "../src/llm/markers";
import { estimateCostUsd } from "../src/llm/pricing";
import { LlmError, ServClient, parseJsonContent } from "../src/llm/serv";

function fakeFetch(handler: (init: RequestInit) => { status?: number; headers?: Record<string, string>; body: unknown }) {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) });
    const r = handler(init);
    return new Response(JSON.stringify(r.body), {
      status: r.status ?? 200,
      headers: { "content-type": "application/json", ...(r.headers ?? {}) },
    });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

const okBody = (content: string | null, extra: Record<string, unknown> = {}) => ({
  id: "chatcmpl-1",
  model: "gpt-6-luna",
  choices: [{ index: 0, message: { role: "assistant", content, ...extra }, finish_reason: "stop" }],
  usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
});

describe("ServClient", () => {
  it("uses completion-token limits for reasoning models and legacy limits for other providers", async () => {
    const { fetchImpl, calls } = fakeFetch(() => ({ body: okBody('{"ok":true}') }));
    const serv = new ServClient({ apiKey: "k", fetchImpl });
    await serv.chat({ model: "gpt-6-luna", system: "sys", user: "usr", maxTokens: 1500 });
    expect(calls[0]!.body.max_completion_tokens).toBe(1500);
    expect(calls[0]!.body).not.toHaveProperty("max_tokens");
    await serv.chat({ model: "other-provider", system: "sys", user: "usr", maxTokens: 1500 });
    expect(calls[1]!.body.max_tokens).toBe(1500);
  });

  it("sends system prompt, strict json schema and marker tools", async () => {
    const { fetchImpl, calls } = fakeFetch(() => ({ body: okBody('{"ok":true}') }));
    const serv = new ServClient({ apiKey: "k", fetchImpl });
    await serv.chat({
      model: "gpt-6-luna",
      system: "sys",
      user: "usr",
      jsonSchema: { name: "t", schema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"], additionalProperties: false } },
      tools: [PROMPT_GUARD, DISABLE_CONTENT_FILTER, shadowAgent("hint", 2)],
    });
    const body = calls[0]!.body as any;
    expect(calls[0]!.url).toBe("https://inference-api.openserv.ai/v1/chat/completions");
    expect(body.messages[0]).toEqual({ role: "system", content: "sys" });
    expect(body.messages[1]).toEqual({ role: "user", content: "usr" });
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.tools.map((t: any) => t.function.name)).toEqual([
      "serv_prompt_guard",
      "serv_disable_content_filter",
      "serv_shadow_agent",
    ]);
    expect(body.tools[2].function.parameters.properties.hint.default).toBe("hint");
    expect(body.stream).toBeUndefined();
  });

  it("flags a prompt-guard refusal and refuses to parse it", async () => {
    const { fetchImpl } = fakeFetch(() => ({
      body: {
        ...okBody(null, { refusal: "I can't share that." }),
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      },
    }));
    const res = await new ServClient({ apiKey: "k", fetchImpl }).chat({ model: "gpt-6-luna", system: "s", user: "u" });
    expect(res.guardRefused).toBe(true);
    expect(res.refusal).toBe("I can't share that.");
    expect(() => parseJsonContent(res, z.object({ ok: z.boolean() }))).toThrowError(
      expect.objectContaining({ kind: "refused" }),
    );
  });

  it("captures the OpenServ request id and estimates cost", async () => {
    const { fetchImpl } = fakeFetch(() => ({ headers: { "x-openserv-request-id": "abc" }, body: okBody("hi") }));
    const res = await new ServClient({ apiKey: "k", fetchImpl }).chat({ model: "gpt-6-luna", system: "s", user: "u" });
    expect(res.requestId).toBe("abc");
    expect(res.usage).toEqual({ promptTokens: 100, completionTokens: 20 });
    expect(res.costUsd).toBeCloseTo((100 * 0.13 + 20 * 0.65) / 1e6, 10);
  });

  it("attaches an abort signal (timeout) to every request", async () => {
    let signal: AbortSignal | null | undefined;
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      signal = init.signal;
      return new Response(JSON.stringify(okBody("hi")), { status: 200 });
    }) as unknown as typeof fetch;
    await new ServClient({ apiKey: "k", fetchImpl }).chat({ model: "m", system: "s", user: "u" });
    expect(signal).toBeInstanceOf(AbortSignal);
  });

  it("throws LlmError(http) with status on non-2xx", async () => {
    const { fetchImpl } = fakeFetch(() => ({ status: 400, body: { error: { message: "A system prompt is required." } } }));
    await expect(new ServClient({ apiKey: "k", fetchImpl }).chat({ model: "m", system: "s", user: "u" })).rejects.toThrowError(
      expect.objectContaining({ kind: "http", status: 400 }),
    );
  });

  it("parses fenced JSON content against a schema", async () => {
    const { fetchImpl } = fakeFetch(() => ({ body: okBody('```json\n{"ok":true}\n```') }));
    const res = await new ServClient({ apiKey: "k", fetchImpl }).chat({ model: "m", system: "s", user: "u" });
    expect(parseJsonContent(res, z.object({ ok: z.boolean() }))).toEqual({ ok: true });
  });

  it("throws LlmError(parse) when content is not valid for the schema", async () => {
    const { fetchImpl } = fakeFetch(() => ({ body: okBody('{"nope":1}') }));
    const res = await new ServClient({ apiKey: "k", fetchImpl }).chat({ model: "m", system: "s", user: "u" });
    expect(() => parseJsonContent(res, z.object({ ok: z.boolean() }))).toThrowError(
      expect.objectContaining({ kind: "parse" }),
    );
  });
});

describe("pricing and audit", () => {
  it("resolves suffixed model names to the base price", () => {
    expect(estimateCostUsd("gpt-6-luna-serv-multipath", { promptTokens: 1_000_000, completionTokens: 0 })).toBe(0.13);
    expect(estimateCostUsd("unknown-model", { promptTokens: 10, completionTokens: 10 })).toBeNull();
  });

  it("builds an audit entry with a sha256 input hash", () => {
    const entry = makeAudit(
      "signals.A",
      "SIGNALS_A_V1",
      "hello",
      { content: "x", refusal: null, guardRefused: false, usage: { promptTokens: 1, completionTokens: 1 }, requestId: "r", durationMs: 5, model: "gpt-6-luna", costUsd: 0.001 },
      "note",
    );
    expect(entry).toMatchObject({ step: "signals.A", promptVersion: "SIGNALS_A_V1", requestId: "r", model: "gpt-6-luna", costUsd: 0.001, durationMs: 5, note: "note" });
    expect(entry.inputHash).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  });
});

it("LlmError carries kind and status", () => {
  const e = new LlmError("http", "boom", 503);
  expect(e).toBeInstanceOf(Error);
  expect(e.kind).toBe("http");
  expect(e.status).toBe(503);
});
