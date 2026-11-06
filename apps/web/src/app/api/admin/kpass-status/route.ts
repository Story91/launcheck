import { NextResponse } from "next/server";
import { KpassUnavailableError, runKpass, sanitizeAllowance, sanitizeStatus } from "@/lib/launchcheck/kpass-runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** Gate 1 check: runs the free, read-only `kpass status` and `kpass allowance status` from this function. Bearer CRON_SECRET. */
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected || req.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const started = Date.now();
  try {
    const status = await runKpass(["status"]);
    const allowance = await runKpass(["allowance", "status"]);
    return NextResponse.json({
      ok: true,
      durationMs: Date.now() - started,
      status: { exitCode: status.exitCode, ...sanitizeStatus(status.json) },
      allowance: { exitCode: allowance.exitCode, meter: sanitizeAllowance(allowance.json, new Date().toISOString()) },
    });
  } catch (e) {
    const known = e instanceof KpassUnavailableError;
    return NextResponse.json({ ok: false, error: known ? (e as Error).message : "kpass failed to start", durationMs: Date.now() - started }, { status: 503 });
  }
}
