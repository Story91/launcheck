import { describe, expect, it } from "vitest";
import type { ChatRequest, ChatResult, LlmClient } from "../src/llm/types";
import { SIGNAL_GROUPS, evaluateSignals, isDegenerate } from "../src/pipeline/signals";
import { Signal, type TenderFacts } from "../src/types";
import factsFixture from "./fixtures/722731-2026.facts.json";
import groupA from "./fixtures/signals-a.json";
import groupB from "./fixtures/signals-b.json";
import groupC from "./fixtures/signals-c.json";
import degenerate from "./fixtures/signals-degenerate.json";

const facts: TenderFacts = { ...(factsFixture as Omit<TenderFacts, "noticeLanguage">), noticeLanguage: "POL" };

const ok = (content: string | null, model: string, refusal: string | null = null): ChatResult => ({
  content,
  refusal,
  guardRefused: content === null && refusal !== null,
  usage: { promptTokens: 10, completionTokens: 5 },
  requestId: "req",
  durationMs: 1,
  model,
  costUsd: 0.0001,
});

/** Stub keyed by group letter (from jsonSchema name "signals_<group>"); each group may have a queue of responses. */
function stub(queues: Partial<Record<"A" | "B" | "C", (ChatResult | Error)[]>>) {
  const requests: ChatRequest[] = [];
  const client: LlmClient = {
    async chat(req) {
      requests.push(req);
      const group = req.jsonSchema?.name.replace("signals_", "") as "A" | "B" | "C";
      const next = queues[group]?.shift();
      if (!next) throw new Error(`no stubbed response for group ${group}`);
      if (next instanceof Error) throw next;
      return next;
    },
  };
  return { client, requests };
}

const deps = (client: LlmClient) => ({ serv: client, model: "gpt-6-luna", fallbackModel: "gpt-5.4-mini" });

describe("SIGNAL_GROUPS", () => {
  it("covers all eight signals exactly once", () => {
    const all = [...SIGNAL_GROUPS.A, ...SIGNAL_GROUPS.B, ...SIGNAL_GROUPS.C];
    expect(new Set(all).size).toBe(8);
  });
});

describe("evaluateSignals", () => {
  it("merges three group calls into eight ordered signals", async () => {
    const { client, requests } = stub({
      A: [ok(JSON.stringify(groupA), "gpt-6-luna-serv-multipath")],
      B: [ok(JSON.stringify(groupB), "gpt-6-luna-serv-multipath")],
      C: [ok(JSON.stringify(groupC), "gpt-6-luna-serv-multipath")],
    });
    const res = await evaluateSignals(facts, deps(client));
    expect(res.signals.map((s) => s.id)).toEqual([
      "S1_SHORT_DEADLINE", "S2_BRAND_LOCK", "S3_OVER_SPECIFICATION", "S4_EXPERIENCE_LOCK",
      "S5_PRICE_WEIGHT_LOW", "S6_DISPROPORTIONATE_CONDITIONS", "S7_NO_LOTS_LARGE_SCOPE", "S8_UNUSUAL_NOTES",
    ]);
    expect(res.signals.find((s) => s.id === "S2_BRAND_LOCK")?.fired).toBe(true);
    expect(res.signals.every((s) => Signal.safeParse(s).success)).toBe(true);
    expect(res.audit).toHaveLength(3);
    expect(res.audit.every((a) => a.model.endsWith("-serv-multipath"))).toBe(true);
    expect(res.audit.map((a) => a.promptVersion).sort()).toEqual(["SIGNALS_A_V2", "SIGNALS_B_V2", "SIGNALS_C_V2"]);
    for (const r of requests) {
      expect(r.model).toBe("gpt-6-luna-serv-multipath");
      expect(r.tools?.map((t) => t.function.name)).toEqual(["serv_disable_content_filter", "serv_shadow_agent"]);
      expect(r.user).toContain("Narodowy Bank Polski");
      expect(r.system).toMatch(/factual observations about the notice/);
      const hint = (r.tools?.[1]?.function.parameters as { properties: { hint: { default: string } } }).properties.hint.default;
      expect(hint).toMatch(/verbatim/);
      expect(hint).toMatch(/no judgement/);
    }
  });

  it("uses the FAR prompt set for US notices", async () => {
    const { client, requests } = stub({
      A: [ok(JSON.stringify(groupA), "gpt-6-luna-serv-multipath")],
      B: [ok(JSON.stringify(groupB), "gpt-6-luna-serv-multipath")],
      C: [ok(JSON.stringify(groupC), "gpt-6-luna-serv-multipath")],
    });
    const res = await evaluateSignals(facts, { ...deps(client), jurisdiction: "US" });
    expect(res.audit.map((a) => a.promptVersion).sort()).toEqual(["SIGNALS_A_US_V1", "SIGNALS_B_US_V3", "SIGNALS_C_US_V1"]);
    for (const r of requests) {
      expect(r.system).toMatch(/Federal Acquisition Regulation/);
      expect(r.system).not.toMatch(/Directive 2014\/24\/EU/);
    }
    expect(requests.find((r) => r.jsonSchema?.name === "signals_B")?.system).toMatch(/brand name or equal/i);
    expect(requests.find((r) => r.jsonSchema?.name === "signals_C")?.system).toMatch(/set-aside/i);
  });

  it("retries a degenerate group once on the fallback model", async () => {
    const { client, requests } = stub({
      A: [ok(JSON.stringify(groupA), "gpt-6-luna-serv-multipath")],
      B: [ok(JSON.stringify(degenerate), "gpt-6-luna-serv-multipath"), ok(JSON.stringify(groupB), "gpt-5.4-mini-serv-multipath")],
      C: [ok(JSON.stringify(groupC), "gpt-6-luna-serv-multipath")],
    });
    const res = await evaluateSignals(facts, deps(client));
    const bAudit = res.audit.filter((a) => a.step === "signals.B");
    expect(bAudit).toHaveLength(2);
    expect(bAudit[1]?.model.startsWith("gpt-5.4-mini")).toBe(true);
    expect(bAudit[0]?.note).toContain("degenerate");
    expect(requests.filter((r) => r.jsonSchema?.name === "signals_B")[1]?.model).toBe("gpt-5.4-mini-serv-multipath");
    expect(res.signals.find((s) => s.id === "S2_BRAND_LOCK")?.fired).toBe(true);
  });

  it("marks a group unavailable after a refusal on both models, leaving other groups intact", async () => {
    const { client } = stub({
      A: [ok(null, "gpt-6-luna", "I can't share that."), ok(null, "gpt-5.4-mini", "I can't share that.")],
      B: [ok(JSON.stringify(groupB), "gpt-6-luna-serv-multipath")],
      C: [ok(JSON.stringify(groupC), "gpt-6-luna-serv-multipath")],
    });
    const res = await evaluateSignals(facts, deps(client));
    const a = res.signals.filter((s) => (SIGNAL_GROUPS.A as readonly string[]).includes(s.id));
    expect(a).toHaveLength(3);
    expect(a.every((s) => !s.fired && s.severity === "none" && s.reason === "evaluation unavailable")).toBe(true);
    expect(res.signals.find((s) => s.id === "S2_BRAND_LOCK")?.fired).toBe(true);
    expect(res.audit.filter((a) => a.step === "signals.A").at(-1)?.note).toContain("group failed");
  });

  it("treats an HTTP error like a failed attempt", async () => {
    const { client } = stub({
      A: [new Error("boom"), ok(JSON.stringify(groupA), "gpt-5.4-mini-serv-multipath")],
      B: [ok(JSON.stringify(groupB), "gpt-6-luna-serv-multipath")],
      C: [ok(JSON.stringify(groupC), "gpt-6-luna-serv-multipath")],
    });
    const res = await evaluateSignals(facts, deps(client));
    expect(res.signals.find((s) => s.id === "S7_NO_LOTS_LARGE_SCOPE")?.fired).toBe(true);
    expect(res.audit.filter((a) => a.step === "signals.A")).toHaveLength(2);
  });
});

describe("isDegenerate", () => {
  it("is true when nothing fired and all reasons are identical", () => {
    expect(isDegenerate(degenerate.signals as Signal[])).toBe(true);
  });
  it("is false for a real result", () => {
    expect(isDegenerate(groupB.signals as Signal[])).toBe(false);
  });
  it("is false when nothing fired but reasons differ", () => {
    expect(isDegenerate(groupA.signals.map((s) => ({ ...s, fired: false, severity: "none" })) as Signal[])).toBe(false);
  });
});
