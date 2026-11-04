import { describe, expect, it } from "vitest";
import { MIGRATION_SQL, runMigration } from "@/lib/db/migrate";

describe("migration", () => {
  it("creates both tables idempotently and mirrors the schema columns", () => {
    const all = MIGRATION_SQL.join("\n");
    expect(all).toMatch(/create table if not exists "reports"/);
    expect(all).toMatch(/create table if not exists "reppo_queue"/);
    for (const col of ["notice_id", "status", "facts", "signals", "risk_score", "summary", "reppo", "audit", "cost_usd", "dropped_evidence", "partial", "error", "progress", "created_at", "updated_at"]) {
      expect(all).toContain(`"${col}"`);
    }
  });

  it("runs every statement in order and reports the count", async () => {
    const ran: string[] = [];
    const applied = await runMigration(async (s) => {
      ran.push(s);
    });
    expect(applied).toBe(MIGRATION_SQL.length);
    expect(ran).toEqual([...MIGRATION_SQL]);
  });

  it("stops at the first failing statement", async () => {
    let n = 0;
    await expect(
      runMigration(async () => {
        n++;
        if (n === 2) throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(n).toBe(2);
  });
});
