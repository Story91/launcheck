import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ChatRequest, ChatResult, LlmClient } from "../src/llm/types";
import { generateReport, type PipelineDeps, type ProgressStep } from "../src/pipeline/run";
import factsFixture from "./fixtures/722731-2026.facts.json";
import groupA from "./fixtures/signals-a.json";
import groupB from "./fixtures/signals-b.json";
import groupC from "./fixtures/signals-c.json";

const xml = readFileSync(new URL("./fixtures/722731-2026.xml", import.meta.url), "utf8");
const factsJson = JSON.stringify({ ...factsFixture, noticeLanguage: "POL" });

const ok = (content: string, model = "gpt-6-luna"): ChatResult => ({
  content,
  refusal: null,
  guardRefused: false,
  usage: { promptTokens: 100, completionTokens: 50 },
  requestId: "req-1",
  durationMs: 2,
  model,
  costUsd: 0.001,
});

/** Routes by request shape: extraction (EXTRACT prompt) → facts; signals_X → group fixture; summary → sentence. */
const servStub: LlmClient = {
  async chat(req: ChatRequest) {
    const name = req.jsonSchema?.name;
    if (name === "signals_A") return ok(JSON.stringify(groupA), "gpt-6-luna-serv-multipath");
    if (name === "signals_B") return ok(JSON.stringify(groupB), "gpt-6-luna-serv-multipath");
    if (name === "signals_C") return ok(JSON.stringify(groupC), "gpt-6-luna-serv-multipath");
    if (name === "summary") return ok(JSON.stringify({ summary: "Two neutral sentences about competition-restriction signals. Second sentence." }));
    if (name === "tender_facts" || req.jsonObject) return ok(factsJson);
    throw new Error(`unexpected request ${name}`);
  },
};

const fetchXml = (async (url: string) =>
  url.includes("722731-2026") ? new Response(xml, { status: 200 }) : new Response("nope", { status: 404 })) as unknown as typeof fetch;

const deps = (over: Partial<PipelineDeps> = {}): PipelineDeps => ({
  serv: servStub,
  dolphin: null,
  servModel: "gpt-6-luna",
  fallbackModel: "gpt-5.4-mini",
  fetchImpl: fetchXml,
  now: () => new Date("2026-11-04T00:00:00Z"),
  ...over,
});

describe("generateReport", () => {
  it("produces a pending_verification report with progress events", async () => {
    const steps: ProgressStep[] = [];
    const report = await generateReport("722731-2026", deps(), (s) => steps.push(s));
    expect(report.status).toBe("pending_verification");
    expect(report.signals).toHaveLength(8);
    expect(report.riskScore).toBeGreaterThan(0);
    expect(report.summary).toContain("competition-restriction");
    expect(report.noticeLanguage).toBe("POL");
    expect(report.buyerPlatform).toBe("https://e-zamowienia.nbp.pl/");
    expect(report.facts?.buyer).toBe("Narodowy Bank Polski");
    expect(report.costUsd).toBeCloseTo(0.005, 6);
    expect(report.audit.map((a) => a.step)).toEqual(["extract.primary", "signals.A", "signals.B", "signals.C", "summary"]);
    expect(report.createdAt).toBe("2026-11-04T00:00:00.000Z");
    expect(steps).toEqual(["ingest", "extract", "signals", "verify", "summary", "done"]);
  });

  it("uses Dolphin as the primary extractor when provided", async () => {
    let dolphinCalls = 0;
    const dolphin: LlmClient = {
      async chat() {
        dolphinCalls++;
        return ok(factsJson, "deepseek-ai/DeepSeek-V4.1-Flash");
      },
    };
    const report = await generateReport("722731-2026", deps({ dolphin }));
    expect(dolphinCalls).toBe(1);
    expect(report.audit[0]?.model).toBe("deepseek-ai/DeepSeek-V4.1-Flash");
  });

  it("drops non-verbatim evidence and records the count", async () => {
    const paraphrased = { signals: groupB.signals.map((s) => (s.id === "S2_BRAND_LOCK" ? { ...s, evidence: ["a paraphrase that is not in the source"] } : s)) };
    const serv: LlmClient = {
      async chat(req) {
        if (req.jsonSchema?.name === "signals_B") return ok(JSON.stringify(paraphrased), "gpt-6-luna-serv-multipath");
        return servStub.chat(req);
      },
    };
    const report = await generateReport("722731-2026", deps({ serv }));
    expect(report.droppedEvidence).toBe(1);
    expect(report.signals.find((s) => s.id === "S2_BRAND_LOCK")?.fired).toBe(false);
  });

  it("fails cleanly when the notice does not exist on TED", async () => {
    const steps: ProgressStep[] = [];
    const report = await generateReport("999999-2026", deps(), (s) => steps.push(s));
    expect(report.status).toBe("failed");
    expect(report.error).toContain("not found on TED");
    expect(report.audit).toEqual([]);
    expect(steps.at(-1)).toBe("failed");
  });

  it("fails without fetching when the id is malformed", async () => {
    let fetched = false;
    const fetchSpy = (async () => {
      fetched = true;
      return new Response("", { status: 200 });
    }) as unknown as typeof fetch;
    const report = await generateReport("abc", deps({ fetchImpl: fetchSpy }));
    expect(report.status).toBe("failed");
    expect(report.error).toMatch(/not a valid TED publication number/);
    expect(fetched).toBe(false);
  });
});
