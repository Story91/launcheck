import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ChatRequest, ChatResult, LlmClient } from "../src/llm/types";
import { analyzeNotice, generateReport, type PipelineDeps, type ProgressStep } from "../src/pipeline/run";
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

const apiFixture = readFileSync(new URL("./fixtures/722731-2026.api.json", import.meta.url), "utf8");
/** TED API answers for the NBP notice (empty result otherwise); the website XML is the fallback path. */
const fetchXml = (async (url: string, init?: RequestInit) => {
  if (url.includes("api.ted.europa.eu")) {
    const q = JSON.parse(String(init?.body)).query as string;
    return new Response(q.includes("722731-2026") ? apiFixture : JSON.stringify({ notices: [] }), { status: 200, headers: { "content-type": "application/json" } });
  }
  return url.includes("722731-2026") ? new Response(xml, { status: 200 }) : new Response("nope", { status: 404 });
}) as unknown as typeof fetch;

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
    expect(report.partial).toBe(false);
    expect(report.signals).toHaveLength(8);
    expect(report.riskScore).toBeGreaterThan(0);
    expect(report.summary).toContain("competition-restriction");
    expect(report.noticeLanguage).toBe("POL");
    expect(report.buyerPlatform).toMatch(/^https:\/\/e-zamowienia\.nbp\.pl\/?$/);
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

  it("keeps the report when only the summary step fails, with a template summary and an audit note", async () => {
    const noSummary: LlmClient = {
      async chat(req) {
        if (req.jsonSchema?.name === "summary") throw new Error("Insufficient credits for this request");
        return servStub.chat(req);
      },
    };
    const report = await generateReport("722731-2026", deps({ serv: noSummary }));
    expect(report.status).toBe("pending_verification");
    expect(report.riskScore).toBeGreaterThan(0);
    expect(report.summary).toMatch(/competition-restriction signals/);
    expect(report.audit.at(-1)?.step).toBe("summary");
    expect(report.audit.at(-1)?.note).toContain("Insufficient credits");
  });

  it("fails the report when every signal group is unavailable", async () => {
    const refusing: LlmClient = {
      async chat(req) {
        if (req.jsonSchema?.name?.startsWith("signals_")) return { ...ok(""), content: null, refusal: "I can't share that.", guardRefused: true, usage: { promptTokens: 0, completionTokens: 0 } };
        return servStub.chat(req);
      },
    };
    const report = await generateReport("722731-2026", deps({ serv: refusing }));
    expect(report.status).toBe("failed");
    expect(report.error).toMatch(/signal evaluation unavailable/);
  });

  it("marks the report partial when some groups are unavailable", async () => {
    const flaky: LlmClient = {
      async chat(req) {
        if (req.jsonSchema?.name === "signals_C") return { ...ok(""), content: null, refusal: "I can't share that.", guardRefused: true, usage: { promptTokens: 0, completionTokens: 0 } };
        return servStub.chat(req);
      },
    };
    const report = await generateReport("722731-2026", deps({ serv: flaky }));
    expect(report.status).toBe("pending_verification");
    expect(report.partial).toBe(true);
    expect(report.signals.filter((s) => s.reason === "evaluation unavailable")).toHaveLength(2);
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
    expect(report.error).toMatch(/neither a SAM.gov notice id .* nor a TED publication number/);
    expect(fetched).toBe(false);
  });
});

describe("generateReport for SAM.gov (US) notices", () => {
  const SAM_ID = "3f2a9c41d7e84b6a9b1c0d2e5f6a7b8c";
  const samSearch = readFileSync(new URL("./fixtures/sam-search.json", import.meta.url), "utf8");
  const samDesc = readFileSync(new URL("./fixtures/sam-description.json", import.meta.url), "utf8");
  const samFetch = (async (url: string) =>
    new Response(url.includes("/noticedesc") ? samDesc : samSearch, { status: 200, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;

  it("ingests from SAM.gov, extracts with a US jurisdiction hint and evaluates with the FAR prompts", async () => {
    const requests: ChatRequest[] = [];
    const recording: LlmClient = { chat: (req) => (requests.push(req), servStub.chat(req)) };
    const report = await generateReport(SAM_ID, deps({ serv: recording, fetchImpl: samFetch, samApiKey: "k" }));
    expect(report.status).toBe("pending_verification");
    expect(report.noticeLanguage).toBe("ENG");
    expect(report.buyerPlatform).toBe(`https://sam.gov/opp/${SAM_ID}/view`);
    expect(requests.find((r) => r.jsonSchema?.name === "tender_facts")?.user).toContain("jurisdiction: US federal (FAR)");
    expect(report.audit.filter((a) => a.step.startsWith("signals.")).map((a) => a.promptVersion).sort()).toEqual(["SIGNALS_A_US_V1", "SIGNALS_B_US_V2", "SIGNALS_C_US_V1"]);
  });

  it("fails with a clear message when SAM_API_KEY is missing", async () => {
    const report = await generateReport(SAM_ID, deps({ fetchImpl: samFetch }));
    expect(report.status).toBe("failed");
    expect(report.error).toMatch(/SAM_API_KEY/);
  });

  it("names both accepted id formats when the id is malformed", async () => {
    const report = await generateReport("abc", deps());
    expect(report.error).toMatch(/SAM\.gov notice id/);
    expect(report.error).toMatch(/TED publication number/);
  });
});

describe("analyzeNotice (pre-fetched text, used by the evaluation set)", () => {
  it("runs extract → signals → verify on given text with the requested rules, without fetching", async () => {
    const requests: ChatRequest[] = [];
    const recording: LlmClient = { chat: (req) => (requests.push(req), servStub.chat(req)) };
    const noFetch = (async () => {
      throw new Error("must not fetch");
    }) as unknown as typeof fetch;
    const report = await analyzeNotice(
      "gao-B-000001",
      { text: xml, language: "ENG", buyerPlatform: null },
      "US",
      deps({ serv: recording, fetchImpl: noFetch }),
      { summary: false },
    );
    expect(report.status).toBe("pending_verification");
    expect(report.signals).toHaveLength(8);
    expect(report.summary).toBeNull();
    expect(requests.some((r) => r.jsonSchema?.name === "summary")).toBe(false);
    expect(report.audit.filter((a) => a.step.startsWith("signals.")).map((a) => a.promptVersion).sort()).toEqual(["SIGNALS_A_US_V1", "SIGNALS_B_US_V2", "SIGNALS_C_US_V1"]);
  });
});

describe("generateReport with imported SAM.gov notices (public daily extract, no API key)", () => {
  const SAM_ID = "3aeff044414241b595f6a5752d18e242";
  const flat = { text: "title: HID ID/Access Cards\ndescription: ** THIS IS A BRAND NAME REQUIREMENT **", language: "ENG", buyerPlatform: `https://sam.gov/opp/${SAM_ID}/view` };
  const noFetch = (async () => {
    throw new Error("must not fetch");
  }) as unknown as typeof fetch;

  it("reads the notice from the imported store before calling the API", async () => {
    const report = await generateReport(SAM_ID, deps({ fetchImpl: noFetch, samNoticeLookup: async (id) => (id === SAM_ID ? flat : null) }));
    expect(report.status).toBe("pending_verification");
    expect(report.buyerPlatform).toBe(`https://sam.gov/opp/${SAM_ID}/view`);
    expect(report.audit.filter((a) => a.step.startsWith("signals.")).map((a) => a.promptVersion).sort()).toEqual(["SIGNALS_A_US_V1", "SIGNALS_B_US_V2", "SIGNALS_C_US_V1"]);
  });

  it("explains a miss when the notice is not imported and no API key is set", async () => {
    const report = await generateReport(SAM_ID, deps({ fetchImpl: noFetch, samNoticeLookup: async () => null }));
    expect(report.status).toBe("failed");
    expect(report.error).toMatch(/not in the imported SAM\.gov extract/);
  });
});
