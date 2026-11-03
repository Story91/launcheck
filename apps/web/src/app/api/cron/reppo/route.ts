import { NextResponse } from "next/server";
import { buildReppoClient } from "@/lib/deps";
import { runReppoTick } from "@/lib/reppo-worker";
import { reportStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Vercel cron target (every minute). Also callable locally: curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/reppo */
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (expected && req.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const reppo = buildReppoClient();
  if (!reppo) return NextResponse.json({ skipped: "REPPO_EVAL_API_KEY not set" });
  const result = await runReppoTick(reportStore(), reppo);
  return NextResponse.json(result);
}
