import type { FlatNotice, ImportedSamNotice, NoticeSummary } from "@tendr/core";
import { and, desc, gt, isNull, lt, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { resolveDatabaseUrl } from "@/lib/db/url";

/** Federal IT services and data processing: the default homepage list. */
export const IT_NAICS_PREFIXES = ["5415", "5182"] as const;

export interface ListOpenOptions {
  naicsPrefixes: readonly string[];
  limit: number;
  now: Date;
}

/** Notices imported from the SAM.gov public daily extract. */
export interface SamNoticeStore {
  upsertMany(notices: ImportedSamNotice[]): Promise<void>;
  get(noticeId: string): Promise<FlatNotice | null>;
  /** Open solicitations (deadline in the future or unknown) for the NAICS prefixes, newest first. */
  listOpen(opts: ListOpenOptions): Promise<NoticeSummary[]>;
  pruneOlderThan(cutoff: Date): Promise<number>;
  count(): Promise<number>;
}

/** "DEPT OF DEFENSE.DEPT OF THE NAVY.FLC PUGET SOUND" → "DEPT OF THE NAVY": the sub-tier reads better than office codes. */
const buyerName = (agency: string) => {
  const parts = agency.split(".").map((p) => p.trim()).filter(Boolean);
  return parts[1] ?? parts[0] ?? agency;
};
const summary = (n: { noticeId: string; title: string; agency: string; responseDeadline: string | null }): NoticeSummary => ({
  noticeId: n.noticeId,
  title: n.title,
  buyer: buyerName(n.agency),
  deadline: n.responseDeadline,
});

export class MemorySamNoticeStore implements SamNoticeStore {
  private rows = new Map<string, ImportedSamNotice>();
  async upsertMany(notices: ImportedSamNotice[]) {
    for (const n of notices) this.rows.set(n.noticeId, n);
  }
  async get(noticeId: string) {
    return this.rows.get(noticeId)?.flat ?? null;
  }
  async listOpen({ naicsPrefixes, limit, now }: ListOpenOptions) {
    const open = [...this.rows.values()]
      .filter((n) => naicsPrefixes.some((p) => n.naics?.startsWith(p)))
      .filter((n) => !n.responseDeadline || new Date(n.responseDeadline) > now)
      .sort((a, b) => b.postedAt.localeCompare(a.postedAt));
    return dedupeBySolicitation(open).slice(0, limit).map(summary);
  }
  async pruneOlderThan(cutoff: Date) {
    let pruned = 0;
    for (const [id, n] of this.rows) if (new Date(n.postedAt) < cutoff) (this.rows.delete(id), pruned++);
    return pruned;
  }
  async count() {
    return this.rows.size;
  }
}

/** Amendments are posted as new notices with the same solicitation number: keep the first (newest) of each. */
function dedupeBySolicitation<T extends { noticeId: string; solicitationNumber: string | null }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const key = r.solicitationNumber?.trim().toUpperCase() || r.noticeId;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const deadlineAt = (s: string | null) => {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

export class DrizzleSamNoticeStore implements SamNoticeStore {
  async upsertMany(notices: ImportedSamNotice[]) {
    if (notices.length === 0) return;
    const t = schema.samNotices;
    await db()
      .insert(t)
      .values(
        notices.map((n) => ({
          noticeId: n.noticeId,
          title: n.title,
          solicitationNumber: n.solicitationNumber,
          agency: n.agency,
          postedAt: new Date(n.postedAt),
          responseDeadline: n.responseDeadline,
          responseDeadlineAt: deadlineAt(n.responseDeadline),
          naics: n.naics,
          setAside: n.setAside,
          link: n.link,
          text: n.flat.text,
          importedAt: new Date(),
        })),
      )
      .onConflictDoUpdate({
        target: t.noticeId,
        set: {
          title: sql`excluded.title`,
          solicitationNumber: sql`excluded.solicitation_number`,
          agency: sql`excluded.agency`,
          postedAt: sql`excluded.posted_at`,
          responseDeadline: sql`excluded.response_deadline`,
          responseDeadlineAt: sql`excluded.response_deadline_at`,
          naics: sql`excluded.naics`,
          setAside: sql`excluded.set_aside`,
          link: sql`excluded.link`,
          text: sql`excluded.text`,
          importedAt: sql`excluded.imported_at`,
        },
      });
  }
  async get(noticeId: string) {
    const rows = await db().select().from(schema.samNotices).where(sql`${schema.samNotices.noticeId} = ${noticeId}`).limit(1);
    const r = rows[0];
    return r ? { text: r.text, language: "ENG", buyerPlatform: r.link } : null;
  }
  async listOpen({ naicsPrefixes, limit, now }: ListOpenOptions) {
    const t = schema.samNotices;
    const naics = or(...naicsPrefixes.map((p) => sql`${t.naics} like ${`${p}%`}`));
    const rows = await db()
      .select({ noticeId: t.noticeId, title: t.title, agency: t.agency, responseDeadline: t.responseDeadline, solicitationNumber: t.solicitationNumber })
      .from(t)
      .where(and(naics, or(isNull(t.responseDeadlineAt), gt(t.responseDeadlineAt, now))))
      .orderBy(desc(t.postedAt))
      .limit(limit * 4);
    return dedupeBySolicitation(rows).slice(0, limit).map(summary);
  }
  async pruneOlderThan(cutoff: Date) {
    const rows = await db().delete(schema.samNotices).where(lt(schema.samNotices.postedAt, cutoff)).returning({ id: schema.samNotices.noticeId });
    return rows.length;
  }
  async count() {
    const rows = await db().select({ n: sql<number>`count(*)::int` }).from(schema.samNotices);
    return rows[0]?.n ?? 0;
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __tendrSamNotices: MemorySamNoticeStore | undefined;
}

export function samNoticeStore(): SamNoticeStore {
  if (resolveDatabaseUrl(process.env)) return new DrizzleSamNoticeStore();
  globalThis.__tendrSamNotices ??= new MemorySamNoticeStore();
  return globalThis.__tendrSamNotices;
}

export interface ImportOptions {
  now: Date;
  /** Notices posted earlier than this are deleted after the import. Default 45 days. */
  keepDays?: number;
  batchSize?: number;
}

/** Streams notices into the store in batches, then prunes old ones. */
export async function importSamNotices(store: SamNoticeStore, source: AsyncIterable<ImportedSamNotice>, opts: ImportOptions) {
  const size = opts.batchSize ?? 250;
  let batch: ImportedSamNotice[] = [];
  let imported = 0;
  for await (const n of source) {
    batch.push(n);
    if (batch.length >= size) {
      await store.upsertMany(batch);
      imported += batch.length;
      batch = [];
    }
  }
  await store.upsertMany(batch);
  imported += batch.length;
  const cutoff = new Date(opts.now.getTime() - (opts.keepDays ?? 45) * 24 * 3600 * 1000);
  const pruned = await store.pruneOlderThan(cutoff);
  return { imported, pruned, total: await store.count() };
}
