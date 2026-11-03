import { describe, expect, it } from "vitest";
import { DolphinClient } from "../src/llm/dolphin";
import { LlmError } from "../src/llm/serv";
import type { ChatRequest, ChatResult, LlmClient } from "../src/llm/types";
import { extractFacts } from "../src/pipeline/extract";
import facts from "./fixtures/722731-2026.facts.json";

const ok = (content: string, model = "stub"): ChatResult => ({
  content,
  refusal: null,
  guardRefused: false,
  usage: { promptTokens: 10, completionTokens: 5 },
  requestId: null,
  durationMs: 1,
  model,
  costUsd: 0.0001,
});

class StubClient implements LlmClient {
  requests: ChatRequest[] = [];
  constructor(private readonly handler: (req: ChatRequest) => ChatResult | Promise<ChatResult>) {}
  chat(req: ChatRequest) {
    this.requests.push(req);
    return Promise.resolve(this.handler(req));
  }
}

const factsJson = JSON.stringify({ ...facts, noticeLanguage: "POL" });

describe("extractFacts", () => {
  it("uses the primary client and records one audit entry", async () => {
    const primary = new StubClient(() => ok(factsJson, "deepseek-ai/DeepSeek-V4.1-Flash"));
    const fallback = new StubClient(() => {
      throw new Error("must not be called");
    });
    const res = await extractFacts("source text", "POL", {
      primary,
      fallback,
      primaryModel: "deepseek-ai/DeepSeek-V4.1-Flash",
      fallbackModel: "gemini-3.1-flash-lite",
    });
    expect(res.facts.buyer).toBe("Narodowy Bank Polski");
    expect(res.facts.noticeLanguage).toBe("POL");
    expect(res.audit).toHaveLength(1);
    expect(res.audit[0]?.step).toBe("extract.primary");
    expect(primary.requests[0]?.jsonObject).toBe(true);
    expect(primary.requests[0]?.user).toContain("source text");
  });

  it("falls back to SERV with a strict schema when the primary fails", async () => {
    const primary = new StubClient(() => {
      throw new LlmError("http", "insufficient credits", 402);
    });
    const fallback = new StubClient(() => ok(factsJson, "gemini-3.1-flash-lite"));
    const res = await extractFacts("source text", "POL", {
      primary,
      fallback,
      primaryModel: "deepseek-ai/DeepSeek-V4.1-Flash",
      fallbackModel: "gemini-3.1-flash-lite",
    });
    expect(res.audit.map((a) => a.step)).toEqual(["extract.primary", "extract.fallback"]);
    expect(res.audit[0]?.note).toContain("insufficient credits");
    expect(fallback.requests[0]?.jsonSchema?.name).toBe("tender_facts");
    expect(fallback.requests[0]?.tools?.map((t) => t.function.name)).toEqual(["serv_disable_content_filter"]);
  });

  it("falls back when the primary returns JSON that does not match the schema", async () => {
    const primary = new StubClient(() => ok('{"buyer":"x"}'));
    const fallback = new StubClient(() => ok(factsJson));
    const res = await extractFacts("t", "POL", { primary, fallback, primaryModel: "p", fallbackModel: "f" });
    expect(res.facts.title).toContain("SMTP");
    expect(res.audit).toHaveLength(2);
  });

  it("rejects with the fallback error when both fail", async () => {
    const primary = new StubClient(() => {
      throw new LlmError("http", "p down", 500);
    });
    const fallback = new StubClient(() => {
      throw new LlmError("http", "f down", 503);
    });
    await expect(extractFacts("t", "POL", { primary, fallback, primaryModel: "p", fallbackModel: "f" })).rejects.toThrowError(
      expect.objectContaining({ message: "f down" }),
    );
  });
});

describe("DolphinClient", () => {
  it("targets the Dolphin lighthouse endpoint with json_object and max_tokens", async () => {
    const calls: { url: string; body: any }[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      return new Response(
        JSON.stringify({ model: "deepseek-ai/DeepSeek-V4.1-Flash", choices: [{ message: { content: "{}" } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as unknown as typeof fetch;
    const res = await new DolphinClient({ apiKey: "k", fetchImpl }).chat({ model: "deepseek-ai/DeepSeek-V4.1-Flash", system: "s", user: "u", jsonObject: true });
    expect(calls[0]?.url).toBe("https://lighthouse.dphn.ai/run/text-v/v1/chat/completions");
    expect(calls[0]?.body.response_format).toEqual({ type: "json_object" });
    expect(calls[0]?.body.max_tokens).toBe(3000);
    expect(res.requestId).toBeNull();
    expect(res.costUsd).toBeCloseTo((1 * 0.01 + 1 * 0.07) / 1e6, 12);
  });
});
