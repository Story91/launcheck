import { isLaunchcheckOperator } from "@/lib/launchcheck/operator";
import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import { runMigration } from "@/lib/db/migrate";
import { resolveDatabaseUrl } from "@/lib/db/url";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** One-off schema bootstrap on the deployed database. Auth: Authorization: Bearer <CRON_SECRET>. */
export async function POST(req: Request) {
  if (!isLaunchcheckOperator(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = resolveDatabaseUrl(process.env);
  if (!url) {
    return NextResponse.json({ error: "no postgres connection string set (DATABASE_URL / STORAGE_URL / POSTGRES_URL)" }, { status: 503 });
  }
  try {
    const sql = neon(url);
    const applied = await runMigration((statement) => sql.query(statement));
    return NextResponse.json({ ok: true, applied });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
