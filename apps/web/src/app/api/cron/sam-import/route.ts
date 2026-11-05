import { readSamExtract } from "@tendr/core";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { importSamNotices, samNoticeStore } from "@/lib/sam-notices";

export const dynamic = "force-dynamic";
// The extract is ~200 MB; streaming and upserting the recent offers takes a minute or two.
export const maxDuration = 300;

/**
 * Daily Vercel cron (after SAM.gov publishes the extract around 04:30 UTC). Imports active solicitations from the
 * last 30 days into sam_notices. Manual run: curl -H "Authorization: Bearer $CRON_SECRET" <host>/api/cron/sam-import
 */
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (expected && req.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const t0 = Date.now();
  try {
    const now = new Date();
    const result = await importSamNotices(samNoticeStore(), readSamExtract({ now: () => now, days: 30 }), { now });
    // The home page lists open solicitations; refresh it now instead of waiting for the hourly revalidation.
    revalidatePath("/");
    return NextResponse.json({ ok: true, ...result, durationMs: Date.now() - t0 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message, durationMs: Date.now() - t0 }, { status: 502 });
  }
}
