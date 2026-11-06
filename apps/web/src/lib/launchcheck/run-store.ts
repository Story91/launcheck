import { neon } from "@neondatabase/serverless";
import { launchCheckReportSchema, type LaunchCheckReport } from "@tendr/core";
import { resolveDatabaseUrl } from "@/lib/db/url";

/** Persistence for LaunchCheck runs: the report JSON per run, screenshots, and the daily spend ledger. */
export interface RunStore {
  createRun(report: LaunchCheckReport, meta: { ipHash: string; creatorHash: string }): Promise<void>;
  saveReport(report: LaunchCheckReport): Promise<void>;
  getReport(id: string): Promise<LaunchCheckReport | null>;
  creatorHash(id: string): Promise<string | null>;
  deleteRun(id: string): Promise<void>;
  countRecentByIp(ipHash: string, since: Date): Promise<number>;
  latestDoneForOrigin(origin: string, since: Date): Promise<string | null>;
  /** Adds `amount` to the day's total only if the result stays within `cap`; true when reserved. */
  reserveDailySpend(day: string, amount: number, cap: number): Promise<boolean>;
  dailySpend(day: string): Promise<number>;
  saveImage(id: string, runId: string, png: Buffer): Promise<void>;
  getImage(id: string): Promise<Buffer | null>;
}

interface Row { report: LaunchCheckReport; ipHash: string; creatorHash: string; createdAt: number }

export class MemoryRunStore implements RunStore {
  private runs = new Map<string, Row>();
  private spend = new Map<string, number>();
  private images = new Map<string, Buffer>();
  async createRun(report: LaunchCheckReport, meta: { ipHash: string; creatorHash: string }) {
    this.runs.set(report.id, { report: structuredClone(report), ...meta, createdAt: Date.now() });
  }
  async saveReport(report: LaunchCheckReport) {
    const row = this.runs.get(report.id);
    if (row) row.report = structuredClone(report);
  }
  async getReport(id: string) {
    const row = this.runs.get(id);
    return row ? structuredClone(row.report) : null;
  }
  async creatorHash(id: string) {
    return this.runs.get(id)?.creatorHash ?? null;
  }
  async deleteRun(id: string) {
    this.runs.delete(id);
  }
  async countRecentByIp(ipHash: string, since: Date) {
    return [...this.runs.values()].filter((r) => r.ipHash === ipHash && r.createdAt >= since.getTime()).length;
  }
  async latestDoneForOrigin(origin: string, since: Date) {
    const rows = [...this.runs.values()].filter((r) => r.report.origin === origin && r.report.status === "done" && r.createdAt >= since.getTime());
    rows.sort((a, b) => b.createdAt - a.createdAt);
    return rows[0]?.report.id ?? null;
  }
  async reserveDailySpend(day: string, amount: number, cap: number) {
    const current = this.spend.get(day) ?? 0;
    if (Math.round((current + amount) * 1e6) > Math.round(cap * 1e6)) return false;
    this.spend.set(day, Math.round((current + amount) * 1e6) / 1e6);
    return true;
  }
  async dailySpend(day: string) {
    return this.spend.get(day) ?? 0;
  }
  async saveImage(id: string, _runId: string, png: Buffer) {
    this.images.set(id, Buffer.from(png));
  }
  async getImage(id: string) {
    return this.images.get(id) ?? null;
  }
}

export class NeonRunStore implements RunStore {
  private sql;
  constructor(url: string) {
    this.sql = neon(url);
  }
  async createRun(report: LaunchCheckReport, meta: { ipHash: string; creatorHash: string }) {
    await this.sql.query(
      `insert into lc_runs (id, url, origin, tier, status, report, ip_hash, creator_hash, spent_usd) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [report.id, report.url, report.origin, report.tier, report.status, JSON.stringify(report), meta.ipHash, meta.creatorHash, report.spentUsd],
    );
  }
  async saveReport(report: LaunchCheckReport) {
    await this.sql.query(`update lc_runs set report = $2, status = $3, spent_usd = $4, updated_at = now() where id = $1`, [report.id, JSON.stringify(report), report.status, report.spentUsd]);
  }
  async getReport(id: string) {
    const rows = (await this.sql.query(`select report from lc_runs where id = $1`, [id])) as { report: unknown }[];
    if (!rows[0]) return null;
    const parsed = launchCheckReportSchema.safeParse(rows[0].report);
    return parsed.success ? parsed.data : null;
  }
  async creatorHash(id: string) {
    const rows = (await this.sql.query(`select creator_hash from lc_runs where id = $1`, [id])) as { creator_hash: string }[];
    return rows[0]?.creator_hash ?? null;
  }
  async deleteRun(id: string) {
    await this.sql.query(`delete from lc_images where run_id = $1`, [id]);
    await this.sql.query(`delete from lc_runs where id = $1`, [id]);
  }
  async countRecentByIp(ipHash: string, since: Date) {
    const rows = (await this.sql.query(`select count(*)::int as n from lc_runs where ip_hash = $1 and created_at >= $2`, [ipHash, since.toISOString()])) as { n: number }[];
    return rows[0]?.n ?? 0;
  }
  async latestDoneForOrigin(origin: string, since: Date) {
    const rows = (await this.sql.query(`select id from lc_runs where origin = $1 and status = 'done' and created_at >= $2 order by created_at desc limit 1`, [origin, since.toISOString()])) as { id: string }[];
    return rows[0]?.id ?? null;
  }
  async reserveDailySpend(day: string, amount: number, cap: number) {
    // The insert branch has no WHERE, so an amount above the cap must be refused before it can open the day.
    if (amount > cap) return false;
    const rows = (await this.sql.query(
      `insert into lc_daily_spend (day, spent_usd) values ($1, $2)
       on conflict (day) do update set spent_usd = lc_daily_spend.spent_usd + excluded.spent_usd
       where lc_daily_spend.spent_usd + excluded.spent_usd <= $3
       returning spent_usd`,
      [day, amount, cap],
    )) as unknown[];
    return rows.length > 0;
  }
  async dailySpend(day: string) {
    const rows = (await this.sql.query(`select spent_usd from lc_daily_spend where day = $1`, [day])) as { spent_usd: string }[];
    return rows[0] ? Number(rows[0].spent_usd) : 0;
  }
  async saveImage(id: string, runId: string, png: Buffer) {
    await this.sql.query(`insert into lc_images (id, run_id, png_base64) values ($1,$2,$3) on conflict (id) do update set png_base64 = excluded.png_base64`, [id, runId, png.toString("base64")]);
  }
  async getImage(id: string) {
    const rows = (await this.sql.query(`select png_base64 from lc_images where id = $1`, [id])) as { png_base64: string }[];
    return rows[0] ? Buffer.from(rows[0].png_base64, "base64") : null;
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __lcRunStore: RunStore | undefined;
}

export function runStore(): RunStore {
  const url = resolveDatabaseUrl(process.env);
  if (url) return (globalThis.__lcRunStore ??= new NeonRunStore(url));
  return (globalThis.__lcRunStore ??= new MemoryRunStore());
}
