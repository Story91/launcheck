import type { PipelineDeps, Report } from "@tenderhound/core";
import { describe, expect, it } from "vitest";
import { internalReportResponse, startGeneration } from "@/lib/reports";
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
  error: null,
  createdAt: "2026-11-04T00:00:00.000Z",
  updatedAt: "2026-11-04T00:00:00.000Z",
  ...over,
});

const deps = {} as PipelineDeps;

describe("startGeneration", () => {
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
    await store.upsert(baseReport({ status: "verified" }));
    const ok = await internalReportResponse(store, "722731-2026", secret, secret);
    expect(ok.status).toBe(200);
    expect((ok.body as Report).riskScore).toBe(35);
    await store.upsert(baseReport({ status: "disputed" }));
    expect((await internalReportResponse(store, "722731-2026", secret, secret)).status).toBe(200);
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
