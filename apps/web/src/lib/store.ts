import type { Report } from "@tenderhound/core";
import { asc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export type StoredReport = Report & { progress: string | null };

export interface ReportStore {
  get(id: string): Promise<StoredReport | null>;
  upsert(r: Report & { progress?: string }): Promise<void>;
  enqueueReppo(id: string): Promise<void>;
  nextReppo(): Promise<{ noticeId: string; attempts: number } | null>;
  dequeueReppo(id: string): Promise<void>;
  incrementReppoAttempts(id: string): Promise<number>;
  findReppoPending(): Promise<Report | null>;
  listRecent(limit: number): Promise<StoredReport[]>;
}

export class MemoryReportStore implements ReportStore {
  private readonly reports = new Map<string, StoredReport>();
  private readonly queue = new Map<string, { enqueuedAt: number; attempts: number }>();

  async get(id: string) {
    const r = this.reports.get(id);
    return r ? structuredClone(r) : null;
  }
  async upsert(r: Report & { progress?: string }) {
    const prev = this.reports.get(r.noticeId);
    this.reports.set(r.noticeId, { ...r, progress: r.progress ?? prev?.progress ?? null });
  }
  async enqueueReppo(id: string) {
    if (!this.queue.has(id)) this.queue.set(id, { enqueuedAt: Date.now(), attempts: 0 });
  }
  async nextReppo() {
    const first = [...this.queue.entries()].sort((a, b) => a[1].enqueuedAt - b[1].enqueuedAt)[0];
    return first ? { noticeId: first[0], attempts: first[1].attempts } : null;
  }
  async dequeueReppo(id: string) {
    this.queue.delete(id);
  }
  async incrementReppoAttempts(id: string) {
    const q = this.queue.get(id);
    if (!q) return 0;
    q.attempts += 1;
    return q.attempts;
  }
  async findReppoPending() {
    for (const r of this.reports.values()) if (r.reppo?.status === "PENDING") return structuredClone(r);
    return null;
  }
  async listRecent(limit: number) {
    return [...this.reports.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit);
  }
}

type Row = typeof schema.reports.$inferSelect;

function rowToReport(row: Row): StoredReport {
  return {
    noticeId: row.noticeId,
    status: row.status as Report["status"],
    noticeLanguage: row.noticeLanguage,
    buyerPlatform: row.buyerPlatform,
    facts: (row.facts as Report["facts"]) ?? null,
    signals: (row.signals as Report["signals"]) ?? [],
    riskScore: row.riskScore,
    summary: row.summary,
    reppo: (row.reppo as Report["reppo"]) ?? null,
    audit: (row.audit as Report["audit"]) ?? [],
    costUsd: Number(row.costUsd),
    droppedEvidence: row.droppedEvidence,
    error: row.error,
    progress: row.progress,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class DrizzleReportStore implements ReportStore {
  async get(id: string) {
    const rows = await db().select().from(schema.reports).where(eq(schema.reports.noticeId, id)).limit(1);
    return rows[0] ? rowToReport(rows[0]) : null;
  }
  async upsert(r: Report & { progress?: string }) {
    const values = {
      noticeId: r.noticeId,
      status: r.status,
      noticeLanguage: r.noticeLanguage,
      buyerPlatform: r.buyerPlatform,
      facts: r.facts,
      signals: r.signals,
      riskScore: r.riskScore,
      summary: r.summary,
      reppo: r.reppo,
      audit: r.audit,
      costUsd: r.costUsd.toFixed(6),
      droppedEvidence: r.droppedEvidence,
      error: r.error,
      ...(r.progress !== undefined ? { progress: r.progress } : {}),
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
    };
    const { noticeId: _id, createdAt: _c, ...update } = values;
    await db().insert(schema.reports).values(values).onConflictDoUpdate({ target: schema.reports.noticeId, set: update });
  }
  async enqueueReppo(id: string) {
    await db().insert(schema.reppoQueue).values({ noticeId: id }).onConflictDoNothing();
  }
  async nextReppo() {
    const rows = await db().select().from(schema.reppoQueue).orderBy(asc(schema.reppoQueue.enqueuedAt)).limit(1);
    return rows[0] ? { noticeId: rows[0].noticeId, attempts: rows[0].attempts } : null;
  }
  async dequeueReppo(id: string) {
    await db().delete(schema.reppoQueue).where(eq(schema.reppoQueue.noticeId, id));
  }
  async incrementReppoAttempts(id: string) {
    const rows = await db()
      .update(schema.reppoQueue)
      .set({ attempts: sql`${schema.reppoQueue.attempts} + 1` })
      .where(eq(schema.reppoQueue.noticeId, id))
      .returning({ attempts: schema.reppoQueue.attempts });
    return rows[0]?.attempts ?? 0;
  }
  async findReppoPending() {
    const rows = await db()
      .select()
      .from(schema.reports)
      .where(sql`${schema.reports.reppo} ->> 'status' = 'PENDING'`)
      .limit(1);
    return rows[0] ? rowToReport(rows[0]) : null;
  }
  async listRecent(limit: number) {
    const rows = await db().select().from(schema.reports).orderBy(sql`${schema.reports.updatedAt} desc`).limit(limit);
    return rows.map(rowToReport);
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __tenderhoundMemoryStore: MemoryReportStore | undefined;
}

/** Drizzle/Neon in production; an in-process memory store when DATABASE_URL is unset (local dev and demos only). */
export function reportStore(): ReportStore {
  if (process.env.DATABASE_URL) return new DrizzleReportStore();
  if (!globalThis.__tenderhoundMemoryStore) {
    console.warn("[tenderhound] DATABASE_URL not set — using in-memory report store (data is lost on restart)");
    globalThis.__tenderhoundMemoryStore = new MemoryReportStore();
  }
  return globalThis.__tenderhoundMemoryStore;
}
