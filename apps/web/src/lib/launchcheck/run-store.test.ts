import { launchCheckFixtureReport } from "@tendr/core";
import { describe, expect, it } from "vitest";
import { MemoryRunStore } from "@/lib/launchcheck/run-store";

const report = (id: string, origin = "https://example.com") => ({ ...launchCheckFixtureReport("fx_problems"), id, origin, url: `${origin}/` });

describe("MemoryRunStore", () => {
  it("creates, updates and reads runs", async () => {
    const s = new MemoryRunStore();
    await s.createRun(report("lc_1"), { ipHash: "ip", creatorHash: "c1" });
    await s.saveReport({ ...report("lc_1"), status: "buying", spentUsd: 0.01 });
    expect((await s.getReport("lc_1"))?.status).toBe("buying");
    expect(await s.getReport("lc_nope")).toBeNull();
    expect(await s.creatorHash("lc_1")).toBe("c1");
  });

  it("counts recent runs per IP and finds a recent finished run for an origin", async () => {
    const s = new MemoryRunStore();
    const now = Date.now();
    await s.createRun(report("lc_a"), { ipHash: "ip1", creatorHash: "c" });
    await s.createRun(report("lc_b", "https://other.dev"), { ipHash: "ip1", creatorHash: "c" });
    expect(await s.countRecentByIp("ip1", new Date(now - 3600_000))).toBe(2);
    expect(await s.countRecentByIp("ip2", new Date(now - 3600_000))).toBe(0);
    expect(await s.latestDoneForOrigin("https://example.com", new Date(now - 86_400_000))).toBe("lc_a");
    expect(await s.latestDoneForOrigin("https://nope.dev", new Date(now - 86_400_000))).toBeNull();
  });

  it("reserves daily spend atomically up to the cap", async () => {
    const s = new MemoryRunStore();
    expect(await s.reserveDailySpend("2026-11-06", 0.08, 0.1)).toBe(true);
    expect(await s.reserveDailySpend("2026-11-06", 0.03, 0.1)).toBe(false);
    expect(await s.reserveDailySpend("2026-11-06", 0.02, 0.1)).toBe(true);
    expect(await s.dailySpend("2026-11-06")).toBeCloseTo(0.1, 6);
    expect(await s.reserveDailySpend("2026-11-07", 0.05, 0.1)).toBe(true);
  });

  it("stores and serves evidence images", async () => {
    const s = new MemoryRunStore();
    await s.saveImage("lc_1_ev_x", "lc_1", Buffer.from("PNG"));
    expect((await s.getImage("lc_1_ev_x"))?.toString()).toBe("PNG");
    expect(await s.getImage("missing")).toBeNull();
  });
  it("removes a deleted run's images without affecting another run", async () => {
    const s = new MemoryRunStore();
    await s.createRun(report("lc_a"), { ipHash: "ip", creatorHash: "owner" });
    await s.saveImage("image_a", "lc_a", Buffer.from("A"));
    await s.saveImage("image_b", "lc_b", Buffer.from("B"));
    await s.deleteRun("lc_a");
    expect(await s.getReport("lc_a")).toBeNull();
    expect(await s.getImage("image_a")).toBeNull();
    expect((await s.getImage("image_b"))?.toString()).toBe("B");
  });

  it("reconciles quoted reservations with actual charges and holds the cap when the outcome is unknown", async () => {
    const s = new MemoryRunStore();
    await s.reserveDailySpend("2026-11-06",.005,.1);
    await s.settleDailySpend("2026-11-06",.005,.007,.1);
    expect(await s.dailySpend("2026-11-06")).toBeCloseTo(.007);
    await s.reserveDailySpend("2026-11-06",.005,.1);
    await s.settleDailySpend("2026-11-06",.005,null,.1);
    expect(await s.dailySpend("2026-11-06")).toBe(.1);
    expect(await s.reserveDailySpend("2026-11-06",.005,.1)).toBe(false);
  });
  it("only releases a payment hold after every recorded outcome is resolved", async () => {
    const s = new MemoryRunStore(), r = report("lc_pending");
    r.receipt.lines = [{...r.receipt.lines[0]!,status:"payment_unknown",paidUsd:0}]; r.spentUsd = 0;
    await s.createRun(r,{ipHash:"ip",creatorHash:"owner"}); await s.setSetting("payment_hold","true");
    const day = new Date().toISOString().slice(0,10);
    expect(await s.releasePaymentHoldIfResolved(day)).toBe(false);
    r.receipt.lines[0]!.status = "failed_charged"; r.receipt.lines[0]!.paidUsd = .007; r.spentUsd = .007;
    await s.saveReport(r);
    expect(await s.releasePaymentHoldIfResolved(day)).toBe(true);
    expect(await s.dailySpend(day)).toBeCloseTo(.007); expect(await s.getSetting("payment_hold")).toBe("false");
  });

});
