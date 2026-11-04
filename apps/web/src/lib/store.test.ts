import type { Report } from "@tendr/core";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryReportStore, reportStore } from "@/lib/store";

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
  partial: false,
  error: null,
  createdAt: "2026-11-04T00:00:00.000Z",
  updatedAt: "2026-11-04T00:00:00.000Z",
  ...over,
});

describe("MemoryReportStore.claimGeneration", () => {
  it("claims a new notice once and refuses a second claim while generating", async () => {
    const store = new MemoryReportStore();
    expect(await store.claimGeneration("722731-2026", 5 * 60_000)).toBe(true);
    expect(await store.claimGeneration("722731-2026", 5 * 60_000)).toBe(false);
    expect((await store.get("722731-2026"))?.status).toBe("generating");
  });

  it("re-claims a failed report", async () => {
    const store = new MemoryReportStore();
    await store.upsert(report({ status: "failed", error: "boom" }));
    expect(await store.claimGeneration("722731-2026", 5 * 60_000)).toBe(true);
    expect((await store.get("722731-2026"))?.status).toBe("generating");
  });

  it("re-claims a stale generating report but not a fresh one", async () => {
    const store = new MemoryReportStore();
    await store.upsert({ ...report({ status: "generating" }), updatedAt: new Date(Date.now() - 10 * 60_000).toISOString() });
    expect(await store.claimGeneration("722731-2026", 5 * 60_000)).toBe(true);
    await store.upsert({ ...report({ status: "generating" }), updatedAt: new Date().toISOString() });
    expect(await store.claimGeneration("722731-2026", 5 * 60_000)).toBe(false);
  });

  it("never re-claims a finished report", async () => {
    const store = new MemoryReportStore();
    await store.upsert(report({ status: "verified" }));
    expect(await store.claimGeneration("722731-2026", 5 * 60_000)).toBe(false);
  });
});

describe("MemoryReportStore.setProgress", () => {
  it("updates progress and updatedAt only while generating", async () => {
    const store = new MemoryReportStore();
    await store.claimGeneration("722731-2026", 60_000);
    const before = (await store.get("722731-2026"))!.updatedAt;
    await new Promise((r) => setTimeout(r, 3));
    await store.setProgress("722731-2026", "signals");
    const after = (await store.get("722731-2026"))!;
    expect(after.progress).toBe("signals");
    expect(after.updatedAt > before).toBe(true);
    await store.upsert(report({ status: "pending_verification" }));
    await store.setProgress("722731-2026", "late write");
    expect((await store.get("722731-2026"))?.status).toBe("pending_verification");
    expect((await store.get("722731-2026"))?.progress).not.toBe("late write");
  });
});

describe("reportStore() in production", () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
    delete (globalThis as { __tendrMemoryStore?: unknown }).__tendrMemoryStore;
  });

  it("refuses the in-memory fallback when VERCEL_ENV is production", () => {
    delete process.env.DATABASE_URL;
    process.env.VERCEL_ENV = "production";
    expect(() => reportStore()).toThrow(/DATABASE_URL/);
  });

  it("uses the in-memory fallback outside production", () => {
    delete process.env.DATABASE_URL;
    process.env.VERCEL_ENV = "development";
    expect(reportStore()).toBeInstanceOf(MemoryReportStore);
  });
});
