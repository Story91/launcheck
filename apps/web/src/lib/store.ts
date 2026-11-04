import type { Report } from "@tendr/core";
import { and, asc, eq, lt, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { resolveDatabaseUrl } from "@/lib/db/url";

export type StoredReport = Report & { progress: string | null };

export interface ReportStore {
  get(id: string): Promise<StoredReport | null>;
  upsert(r: Report & { progress?: string | null }): Promise<void>;
  /**
   * Atomically takes ownership of a notice for generation. Succeeds when no report exists, the report is `failed`,
   * or it has been `generating` for longer than `staleAfterMs`. Returns false otherwise (someone else owns it).
   */
  claimGeneration(id: string, staleAfterMs: number): Promise<boolean>;
  /** Writes only progress + updatedAt, and only while the report is still `generating` (never clobbers a finished report). */
  setProgress(id: string, step: string): Promise<void>;
  enqueueReppo(id: string): Promise<void>;
  nextReppo(): Promise<{ noticeId: string; attempts: number } | null>;
  dequeueReppo(id: string): Promise<void>;
  incrementReppoAttempts(id: string): Promise<number>;
  findReppoPending(): Promise<Report | null>;
  listRecent(limit: number): Promise<StoredReport[]>;
}

export function placeholderReport(noticeId: string, now = new Date().toISOString()): Report {
  return {
    noticeId,
    status: "generating",
    noticeLanguage: null,
    buyerPlatform: null,
    facts: null,
    signals: [],
    riskScore: 0,
    summary: null,
    reppo: null,
    audit: [],
    costUsd: 0,
    droppedEvidence: 0,
    partial: false,
    error: null,
    createdAt: now,
    updatedAt: now,
  };
}

function claimable(existing: { status: Report["status"]; updatedAt: string } | null, staleAfterMs: number, now: number): boolean {
  if (!existing) return true;
  if (existing.status === "failed") return true;
  return existing.status === "generating" && now - new Date(existing.updatedAt).getTime() > staleAfterMs;
}

export class MemoryReportStore implements ReportStore {
  private readonly reports = new Map<string, StoredReport>();
  private readonly queue = new Map<string, { enqueuedAt: number; attempts: number }>();

  async get(id: string) {
    const r = this.reports.get(id);
    return r ? structuredClone(r) : null;
  }
  async upsert(r: Report & { progress?: string | null }) {
    const prev = this.reports.get(r.noticeId);
    this.reports.set(r.noticeId, { ...r, progress: r.progress ?? prev?.progress ?? null });
  }
  async claimGeneration(id: string, staleAfterMs: number) {
    // Map operations are synchronous, so check-then-set is atomic within one process.
    if (!claimable(this.reports.get(id) ?? null, staleAfterMs, Date.now())) return false;
    const prev = this.reports.get(id);
    const now = new Date().toISOString();
    this.reports.set(id, { ...placeholderReport(id, prev?.createdAt ?? now), updatedAt: now, progress: "queued" });
    return true;
  }
  async setProgress(id: string, step: string) {
    const r = this.reports.get(id);
    if (!r || r.status !== "generating") return;
    r.progress = step;
    r.updatedAt = new Date().toISOString();
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
    return [...this.reports.values()]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit)
      .map((r) => structuredClone(r));
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
    partial: row.partial,
    error: row.error,
    progress: row.progress,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toRow(r: Report & { progress?: string | null }) {
  return {
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
    partial: r.partial,
    error: r.error,
    ...(r.progress !== undefined ? { progress: r.progress } : {}),
    createdAt: new Date(r.createdAt),
    updatedAt: new Date(r.updatedAt),
  };
}

export class DrizzleReportStore implements ReportStore {
  async get(id: string) {
    const rows = await db().select().from(schema.reports).where(eq(schema.reports.noticeId, id)).limit(1);
    return rows[0] ? rowToReport(rows[0]) : null;
  }
  async upsert(r: Report & { progress?: string | null }) {
    const values = toRow(r);
    const { noticeId: _id, createdAt: _c, ...update } = values;
    await db().insert(schema.reports).values(values).onConflictDoUpdate({ target: schema.reports.noticeId, set: update });
  }
  async claimGeneration(id: string, staleAfterMs: number) {
    const now = new Date();
    const stale = new Date(now.getTime() - staleAfterMs);
    const values = toRow({ ...placeholderReport(id, now.toISOString()), progress: "queued" });
    const { noticeId: _id, createdAt: _c, ...update } = values;
    const rows = await db()
      .insert(schema.reports)
      .values(values)
      .onConflictDoUpdate({
        target: schema.reports.noticeId,
        set: update,
        setWhere: or(eq(schema.reports.status, "failed"), and(eq(schema.reports.status, "generating"), lt(schema.reports.updatedAt, stale))),
      })
      .returning({ noticeId: schema.reports.noticeId });
    return rows.length > 0;
  }
  async setProgress(id: string, step: string) {
    await db()
      .update(schema.reports)
      .set({ progress: step, updatedAt: new Date() })
      .where(and(eq(schema.reports.noticeId, id), eq(schema.reports.status, "generating")));
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
  var __tendrMemoryStore: MemoryReportStore | undefined;
}

/** Drizzle/Neon when DATABASE_URL is set; an in-process memory store for local dev and demos. Production refuses the fallback. */
export function reportStore(): ReportStore {
  if (resolveDatabaseUrl(process.env)) return new DrizzleReportStore();
  if (process.env.VERCEL_ENV === "production") {
    throw new Error("A postgres connection string (DATABASE_URL or STORAGE_URL) must be set in production (the in-memory store would lose data across instances)");
  }
  if (!globalThis.__tendrMemoryStore) {
    console.warn("[tendr] DATABASE_URL not set — using in-memory report store (data is lost on restart)");
    globalThis.__tendrMemoryStore = new MemoryReportStore();
  }
  return globalThis.__tendrMemoryStore;
}
