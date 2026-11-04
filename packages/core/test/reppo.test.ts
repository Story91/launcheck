import { describe, expect, it } from "vitest";
import { reportToArtifact } from "../src/reppo/artifact";
import { ReppoBusyError, ReppoClient } from "../src/reppo/client";
import { mapVerdictToStatus } from "../src/reppo/map";
import type { Report, ReppoVerdict } from "../src/types";
import factsFixture from "./fixtures/722731-2026.facts.json";
import groupB from "./fixtures/signals-b.json";

function fakeFetch(handler: (url: string, init: RequestInit) => { status?: number; body: unknown }) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const r = handler(url, init);
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

const headersOf = (init: RequestInit) => init.headers as Record<string, string>;

const settledBody = (decision: "accept" | "revise" | "reject") => ({
  evalId: "ev-1",
  status: "SETTLED",
  result: {
    verdict: { score: 82, scale: "0-100", decision, confidence: "high" },
    verdicts: [
      { criterion: "Every fired signal cites a verbatim quote", score: 9, critique: "quotes present" },
      { criterion: "Tone is neutral", score: 8, critique: "no accusations" },
    ],
    action: { route: "auto-ship" },
    evidence: { evidenceBasis: "model-judgment", pods: [], peerAssessmentCount: 2 },
  },
});

describe("ReppoClient.submit", () => {
  it("posts the artifact with a bearer key and the Sandbox header only in sandbox mode", async () => {
    const { fetchImpl, calls } = fakeFetch(() => ({ status: 201, body: { evalId: "ev-1", id: "ev-1", status: "PENDING" } }));
    const sandbox = new ReppoClient({ apiKey: "k", sandbox: true, fetchImpl });
    const live = new ReppoClient({ apiKey: "k", sandbox: false, fetchImpl });
    const input = { payload: "p", context: "c", criteria: ["a"], settlementMinutes: 10 as const };
    expect(await sandbox.submit(input)).toEqual({ evalId: "ev-1" });
    await live.submit(input);
    expect(calls[0]?.url).toBe("https://eval.reppo.xyz/api/v1/agents/eval-requests/submit");
    expect(headersOf(calls[0]!.init).Authorization).toBe("Bearer k");
    expect(headersOf(calls[0]!.init).Sandbox).toBe("true");
    expect(headersOf(calls[1]!.init).Sandbox).toBeUndefined();
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ type: "artifact", payload: "p", context: "c", criteria: ["a"], settlementMinutes: 10 });
  });

  it("throws ReppoBusyError on 409 (one pending evaluation per account)", async () => {
    const { fetchImpl } = fakeFetch(() => ({ status: 409, body: { error: "pending evaluation exists" } }));
    await expect(new ReppoClient({ apiKey: "k", sandbox: true, fetchImpl }).submit({ payload: "p", context: "c", criteria: [], settlementMinutes: 10 })).rejects.toBeInstanceOf(ReppoBusyError);
  });
});

describe("ReppoClient.get", () => {
  it("maps a settled accept verdict", async () => {
    const { fetchImpl, calls } = fakeFetch(() => ({ body: settledBody("accept") }));
    const v = await new ReppoClient({ apiKey: "k", sandbox: false, fetchImpl, now: () => new Date("2026-11-04T10:00:00Z") }).get("ev-1");
    expect(calls[0]?.url).toBe("https://eval.reppo.xyz/api/v1/agents/eval-requests/ev-1");
    expect(v).toMatchObject({ evalId: "ev-1", status: "SETTLED", score: 82, decision: "accept", confidence: "high", evidenceBasis: "model-judgment" });
    expect(v.critique).toBe("quotes present | no accusations");
    expect(v.settledAt).toBe("2026-11-04T10:00:00.000Z");
  });

  it("maps a DENIED evaluation to status FAILED with the decision cleared", async () => {
    const { fetchImpl } = fakeFetch(() => ({ body: { evalId: "ev-3", status: "DENIED", result: null } }));
    const v = await new ReppoClient({ apiKey: "k", sandbox: false, fetchImpl }).get("ev-3");
    expect(v.status).toBe("FAILED");
    expect(mapVerdictToStatus(v)).toBe("unverified");
  });

  it("throws ReppoError with status 402 when credits run out on submit", async () => {
    const { fetchImpl } = fakeFetch(() => ({ status: 402, body: { error: "insufficient credits" } }));
    await expect(new ReppoClient({ apiKey: "k", sandbox: false, fetchImpl }).submit({ payload: "p", context: "c", criteria: [], settlementMinutes: 10 })).rejects.toMatchObject({ name: "ReppoError", status: 402 });
  });

  it("maps a pending evaluation with null verdict fields", async () => {
    const { fetchImpl } = fakeFetch(() => ({ body: { evalId: "ev-2", status: "PENDING" } }));
    const v = await new ReppoClient({ apiKey: "k", sandbox: false, fetchImpl }).get("ev-2");
    expect(v).toMatchObject({ status: "PENDING", score: null, decision: null, settledAt: null });
  });
});

describe("mapVerdictToStatus", () => {
  const base: ReppoVerdict = { evalId: "e", status: "SETTLED", score: 50, decision: null, confidence: null, critique: null, evidenceBasis: null, submittedAt: "", settledAt: "" };
  it("accept → verified", () => expect(mapVerdictToStatus({ ...base, decision: "accept" })).toBe("verified"));
  it("revise → disputed", () => expect(mapVerdictToStatus({ ...base, decision: "revise" })).toBe("disputed"));
  it("reject → withheld", () => expect(mapVerdictToStatus({ ...base, decision: "reject" })).toBe("withheld"));
  it("FAILED → unverified", () => expect(mapVerdictToStatus({ ...base, status: "FAILED" })).toBe("unverified"));
  it("PENDING → pending_verification", () => expect(mapVerdictToStatus({ ...base, status: "PENDING", decision: null })).toBe("pending_verification"));
});

describe("reportToArtifact", () => {
  const report: Report = {
    noticeId: "722731-2026",
    status: "pending_verification",
    noticeLanguage: "POL",
    buyerPlatform: null,
    facts: { ...(factsFixture as Omit<Report["facts"] & object, "noticeLanguage">), noticeLanguage: "POL" } as Report["facts"],
    signals: groupB.signals as Report["signals"],
    riskScore: 50,
    summary: "Two sentences.",
    reppo: null,
    audit: [],
    costUsd: 0.01,
    droppedEvidence: 0,
    partial: false,
    error: null,
    createdAt: "",
    updatedAt: "",
  };

  it("builds a markdown payload with the fired signals and their quotes, within 40 KB", () => {
    const a = reportToArtifact(report);
    expect(a.payload.length).toBeLessThanOrEqual(40_000);
    expect(a.payload).toContain("S2_BRAND_LOCK");
    expect(a.payload).toContain("integracją z Systemem DarkTrace");
    expect(a.payload).not.toContain("S3_OVER_SPECIFICATION");
    expect(a.context).toContain("neutral");
    expect(a.criteria).toEqual([
      "Every fired signal cites a verbatim quote from the notice",
      "Tone is neutral and descriptive; no accusation of wrongdoing",
      "Severity levels follow the stated rules (high/medium/low)",
    ]);
  });

  it("truncates an oversized payload to the limit", () => {
    const huge = { ...report, signals: report.signals.map((s) => ({ ...s, evidence: ["x".repeat(30_000)] })) };
    expect(reportToArtifact(huge).payload.length).toBeLessThanOrEqual(40_000);
  });
});
