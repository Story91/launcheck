/**
 * Idempotent schema bootstrap, mirrored from ./schema.ts. Runs from the deployed app (GET /api/admin/migrate,
 * bearer CRON_SECRET) so nobody needs the production connection string on a laptop.
 */
export const MIGRATION_SQL: readonly string[] = [
  `create table if not exists "reports" (
    "notice_id" text primary key,
    "status" text not null,
    "notice_language" text,
    "buyer_platform" text,
    "facts" jsonb,
    "signals" jsonb not null default '[]'::jsonb,
    "risk_score" integer not null default 0,
    "summary" text,
    "reppo" jsonb,
    "audit" jsonb not null default '[]'::jsonb,
    "cost_usd" numeric(12, 6) not null default 0,
    "dropped_evidence" integer not null default 0,
    "partial" boolean not null default false,
    "error" text,
    "progress" text,
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now()
  )`,
  `alter table "reports" add column if not exists "partial" boolean not null default false`,
  `create table if not exists "reppo_queue" (
    "notice_id" text primary key,
    "enqueued_at" timestamptz not null default now(),
    "attempts" integer not null default 0
  )`,
  `create index if not exists "reports_updated_at_idx" on "reports" ("updated_at" desc)`,
];

export interface SqlRunner {
  (statement: string): Promise<unknown>;
}

/** Executes every statement in order; returns how many ran. */
export async function runMigration(run: SqlRunner): Promise<number> {
  let applied = 0;
  for (const statement of MIGRATION_SQL) {
    await run(statement);
    applied++;
  }
  return applied;
}
