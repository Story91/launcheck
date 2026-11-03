import { ReppoBusyError, type Report, type ReppoClient, type ReppoVerdict } from "@tenderhound/core";
import { describe, expect, it } from "vitest";
import { MAX_REPPO_ATTEMPTS, runReppoTick } from "@/lib/reppo-worker";
import { MemoryReportStore } from "@/lib/store";

const report = (over: Partial<Report>): Report => ({
  noticeId: "722731-2026",
  status: "pending_verification",
  noticeLanguage: "POL",
  buyerPlatform: null,
  facts: null,
  signals: [],
  riskScore: 30,
  summary: "s",
  reppo: null,
  audit: [],
  costUsd: 0,
  droppedEvidence: 0,
  error: null,
  createdAt: "2026-11-04T00:00:00.000Z",
  updatedAt: "2026-11-04T00:00:00.000Z",
  ...over,
});

const verdict = (over: Partial<ReppoVerdict>): ReppoVerdict => ({
  evalId: "ev-1",
  status: "PENDING",
  score: null,
  decision: null,
  confidence: null,
  critique: null,
  evidenceBasis: null,
  submittedAt: "2026-11-04T00:01:00.000Z",
  settledAt: null,
  ...over,
});

function fakeReppo(opts: { submit?: () => Promise<{ evalId: string }>; get?: (id: string) => Promise<ReppoVerdict> }) {
  const calls = { submit: 0, get: 0 };
  const client = {
    async submit() {
      calls.submit++;
      return (opts.submit ?? (async () => ({ evalId: "ev-1" })))();
    },
    async get(id: string) {
      calls.get++;
      return (opts.get ?? (async () => verdict({})))(id);
    },
  } as unknown as ReppoClient;
  return { client, calls };
}

describe("runReppoTick", () => {
  it("submits the next queued report and marks it PENDING", async () => {
    const store = new MemoryReportStore();
    await store.upsert(report({}));
    await store.enqueueReppo("722731-2026");
    const { client, calls } = fakeReppo({});
    const out = await runReppoTick(store, client);
    expect(out).toEqual({ submitted: "722731-2026" });
    expect(calls.submit).toBe(1);
    expect((await store.get("722731-2026"))?.reppo?.status).toBe("PENDING");
    expect(await store.nextReppo()).toBeNull();
  });

  it("polls a pending evaluation and maps a settled accept to verified", async () => {
    const store = new MemoryReportStore();
    await store.upsert(report({ reppo: verdict({}) }));
    const { client, calls } = fakeReppo({ get: async () => verdict({ status: "SETTLED", decision: "accept", score: 88, settledAt: "2026-11-04T00:20:00.000Z" }) });
    const out = await runReppoTick(store, client);
    expect(out).toEqual({ settled: "722731-2026" });
    expect(calls.submit).toBe(0);
    const stored = await store.get("722731-2026");
    expect(stored?.status).toBe("verified");
    expect(stored?.reppo?.score).toBe(88);
  });

  it("maps reject to withheld and FAILED to unverified", async () => {
    for (const [v, expected] of [
      [verdict({ status: "SETTLED", decision: "reject" }), "withheld"],
      [verdict({ status: "FAILED" }), "unverified"],
    ] as const) {
      const store = new MemoryReportStore();
      await store.upsert(report({ reppo: verdict({}) }));
      await runReppoTick(store, fakeReppo({ get: async () => v }).client);
      expect((await store.get("722731-2026"))?.status).toBe(expected);
    }
  });

  it("leaves a still-pending evaluation untouched and does not submit another", async () => {
    const store = new MemoryReportStore();
    await store.upsert(report({ reppo: verdict({}) }));
    await store.upsert(report({ noticeId: "1-2026" }));
    await store.enqueueReppo("1-2026");
    const { client, calls } = fakeReppo({});
    const out = await runReppoTick(store, client);
    expect(out).toEqual({});
    expect(calls.submit).toBe(0);
    expect(await store.nextReppo()).toMatchObject({ noticeId: "1-2026" });
  });

  it("keeps the report queued when Reppo is busy and counts the attempt", async () => {
    const store = new MemoryReportStore();
    await store.upsert(report({}));
    await store.enqueueReppo("722731-2026");
    const { client } = fakeReppo({ submit: async () => { throw new ReppoBusyError(); } });
    const out = await runReppoTick(store, client);
    expect(out).toEqual({});
    expect(await store.nextReppo()).toMatchObject({ noticeId: "722731-2026", attempts: 1 });
    expect((await store.get("722731-2026"))?.status).toBe("pending_verification");
  });

  it("gives up after MAX_REPPO_ATTEMPTS failures and marks the report unverified", async () => {
    const store = new MemoryReportStore();
    await store.upsert(report({}));
    await store.enqueueReppo("722731-2026");
    const { client } = fakeReppo({ submit: async () => { throw new Error("502 upstream"); } });
    for (let i = 0; i < MAX_REPPO_ATTEMPTS; i++) await runReppoTick(store, client);
    expect((await store.get("722731-2026"))?.status).toBe("unverified");
    expect(await store.nextReppo()).toBeNull();
  });

  it("skips queued ids whose report is missing or no longer pending", async () => {
    const store = new MemoryReportStore();
    await store.enqueueReppo("9-2026");
    const { client, calls } = fakeReppo({});
    expect(await runReppoTick(store, client)).toEqual({});
    expect(calls.submit).toBe(0);
    expect(await store.nextReppo()).toBeNull();
  });
});
