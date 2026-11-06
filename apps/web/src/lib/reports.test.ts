import type { PipelineDeps, Report } from "@tendr/core";
import { describe, expect, it } from "vitest";
import { internalReportResponse, publicView, startGeneration } from "@/lib/reports";
import { MemoryReportStore } from "@/lib/store";

const baseReport = (over: Partial<Report>): Report => ({
  noticeId: "722731-2026",
  status: "pending_verification",
  noticeLanguage: "POL",
  buyerPlatform: null,
  facts: null,
  signals: [],
  riskScore: 35,
  summary: "s",
  reppo: null,
  audit: [],
  costUsd: 0.01,
  droppedEvidence: 0,
  partial: false,
  error: null,
  createdAt: "2026-11-04T00:00:00.000Z",
  updatedAt: "2026-11-04T00:00:00.000Z",
  ...over,
});

const deps = {} as PipelineDeps;

describe("startGeneration", () => {
  it("marks a crashed pipeline failed after draining progress writes, allowing retry", async () => {
    const store = new MemoryReportStore();
    const generate = async (_id: string, _deps: PipelineDeps, progress?: (step: string) => void) => {
      progress?.("extract");
      throw new Error("unexpected failure");
    };
    await expect(startGeneration("722731-2026", store, deps, generate as never)).rejects.toThrow("unexpected failure");
    expect(await store.get("722731-2026")).toMatchObject({ status: "failed", progress: "failed" });
    expect(await store.nextReppo()).toBeNull();
    expect(await store.claimGeneration("722731-2026", 300000)).toBe(true);
  });
  it("creates a generating record, runs the pipeline, stores the result and queues Reppo", async () => {
    const store = new MemoryReportStore();
    const progress: string[] = [];
    const generate = async (id: string, _d: PipelineDeps, onProgress?: (s: string) => void) => {
      onProgress?.("ingest");
      onProgress?.("done");
      return baseReport({ noticeId: id });
    };
    const result = await startGeneration("722731-2026", store, deps, generate as never, (p) => progress.push(p));
    expect(result).toBe("started");
    const stored = await store.get("722731-2026");
    expect(stored?.status).toBe("pending_verification");
    expect(stored?.progress).toBe("done");
    expect(await store.nextReppo()).toMatchObject({ noticeId: "722731-2026", attempts: 0 });
    expect(progress).toEqual(["ingest", "done"]);
  });

  it("returns exists for a report that is not failed and does not re-run", async () => {
    const store = new MemoryReportStore();
    await store.upsert(baseReport({ status: "verified" }));
    let runs = 0;
    const generate = async () => {
      runs++;
      return baseReport({});
    };
    expect(await startGeneration("722731-2026", store, deps, generate as never)).toBe("exists");
    expect(runs).toBe(0);
  });

  it("re-runs a failed report and does not queue Reppo when generation fails", async () => {
    const store = new MemoryReportStore();
    await store.upsert(baseReport({ status: "failed", error: "boom" }));
    const generate = async (id: string) => baseReport({ noticeId: id, status: "failed", error: "still broken" });
    expect(await startGeneration("722731-2026", store, deps, generate as never)).toBe("started");
    expect((await store.get("722731-2026"))?.error).toBe("still broken");
    expect(await store.nextReppo()).toBeNull();
  });

  it("returns exists for a second concurrent start of the same notice (atomic claim)", async () => {
    const store = new MemoryReportStore();
    let runs = 0;
    const generate = async (id: string) => {
      runs++;
      await new Promise((r) => setTimeout(r, 10));
      return baseReport({ noticeId: id });
    };
    const [a, b] = await Promise.all([
      startGeneration("722731-2026", store, deps, generate as never),
      startGeneration("722731-2026", store, deps, generate as never),
    ]);
    expect([a, b].sort()).toEqual(["exists", "started"]);
    expect(runs).toBe(1);
  });

  it("never lets a progress write land after the final report write", async () => {
    const store = new MemoryReportStore();
    const writes: string[] = [];
    const origSet = store.setProgress.bind(store);
    const origUpsert = store.upsert.bind(store);
    store.setProgress = async (id, step) => {
      await new Promise((r) => setTimeout(r, 5));
      writes.push(`progress:${step}`);
      return origSet(id, step);
    };
    store.upsert = async (r) => {
      writes.push(`upsert:${r.status}`);
      return origUpsert(r);
    };
    const generate = async (id: string, _d: PipelineDeps, onProgress?: (s: string) => void) => {
      onProgress?.("ingest");
      onProgress?.("signals");
      onProgress?.("done");
      return baseReport({ noticeId: id });
    };
    await startGeneration("722731-2026", store, deps, generate as never);
    expect(writes.at(-1)).toBe("upsert:pending_verification");
    expect(writes.filter((w) => w.startsWith("progress:"))).toEqual(["progress:ingest", "progress:signals", "progress:done"]);
    expect((await store.get("722731-2026"))?.status).toBe("pending_verification");
  });

  it("writes progress steps to the store while generating", async () => {
    const store = new MemoryReportStore();
    let seenDuringRun: string | null | undefined;
    const generate = async (id: string, _d: PipelineDeps, onProgress?: (s: string) => void) => {
      onProgress?.("signals");
      await new Promise((r) => setTimeout(r, 5));
      seenDuringRun = (await store.get(id))?.progress;
      return baseReport({ noticeId: id });
    };
    await startGeneration("722731-2026", store, deps, generate as never);
    expect(seenDuringRun).toBe("signals");
  });
});

describe("internalReportResponse", () => {
  const secret = "s3cret";

  it("rejects a missing or wrong secret with 401", async () => {
    const store = new MemoryReportStore();
    await store.upsert(baseReport({ status: "verified" }));
    expect((await internalReportResponse(store, "722731-2026", null, secret)).status).toBe(401);
    expect((await internalReportResponse(store, "722731-2026", "nope", secret)).status).toBe(401);
  });

  it("returns 404 for an unknown report", async () => {
    const res = await internalReportResponse(new MemoryReportStore(), "1-2026", secret, secret);
    expect(res.status).toBe(404);
  });

  it("returns 200 with the report only for verified and disputed", async () => {
    const store = new MemoryReportStore();
    const reppo: NonNullable<Report["reppo"]> = { evalId: "e", sandbox: false, status: "SETTLED", score: 88, decision: "accept", confidence: "high", critique: null, evidenceBasis: null, submittedAt: "", settledAt: "" };
    await store.upsert(baseReport({ status: "verified", reppo }));
    const ok = await internalReportResponse(store, "722731-2026", secret, secret);
    expect(ok.status).toBe(200);
    expect((ok.body as Report).riskScore).toBe(35);
    await store.upsert(baseReport({ status: "disputed", reppo: { ...reppo, decision: "revise" } }));
    expect((await internalReportResponse(store, "722731-2026", secret, secret)).status).toBe(200);
  });

  it("does not sell a report with a missing, unfinished or contradictory verdict", async () => {
    const store = new MemoryReportStore();
    for (const reppo of [null, { evalId: "e", status: "PENDING", decision: null }, { evalId: "e", status: "SETTLED", decision: "reject" }] as Report["reppo"][]) {
      await store.upsert(baseReport({ status: "verified", reppo }));
      expect((await internalReportResponse(store, "722731-2026", secret, secret)).status).toBe(409);
    }
  });

  it("refuses to sell a partial report or one whose verdict came from the Reppo sandbox", async () => {
    const store = new MemoryReportStore();
    await store.upsert(baseReport({ status: "verified", partial: true }));
    expect((await internalReportResponse(store, "722731-2026", secret, secret)).status).toBe(409);
    await store.upsert(baseReport({ status: "verified", partial: false, reppo: { evalId: "e", sandbox: true, status: "SETTLED", score: 0, decision: "accept", confidence: null, critique: null, evidenceBasis: null, submittedAt: "", settledAt: "" } }));
    expect((await internalReportResponse(store, "722731-2026", secret, secret)).status).toBe(409);
  });

  it("returns 409 with status and retryAfterSeconds for every other status", async () => {
    const store = new MemoryReportStore();
    for (const status of ["generating", "pending_verification", "withheld", "unverified", "failed"] as const) {
      await store.upsert(baseReport({ status }));
      const res = await internalReportResponse(store, "722731-2026", secret, secret);
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ status, retryAfterSeconds: 60 });
    }
  });
});

describe("publicView", () => {
  it("redacts signals, summary and quotes of a withheld report but keeps the verdict", () => {
    const r = baseReport({
      status: "withheld",
      summary: "secret",
      signals: [{ id: "S2_BRAND_LOCK", fired: true, severity: "high", reason: "r", evidence: ["q"] }],
      reppo: { evalId: "e", status: "SETTLED", score: 10, decision: "reject", confidence: "high", critique: "bad", evidenceBasis: null, submittedAt: "", settledAt: "" },
    });
    const v = publicView({ ...r, progress: "done" });
    expect(v.signals).toEqual([]);
    expect(v.summary).toBeNull();
    expect(v.reppo?.critique).toBe("bad");
    expect(v.status).toBe("withheld");
  });

  it("returns other reports unchanged", () => {
    const r = { ...baseReport({ status: "verified", summary: "ok" }), progress: "done" };
    expect(publicView(r)).toEqual(r);
  });
});
