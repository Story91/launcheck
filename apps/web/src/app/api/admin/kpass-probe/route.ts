import { NextResponse } from "next/server";
import { KpassUnavailableError, runKpass, sanitizeExecute } from "@/lib/launchcheck/kpass-runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

// Gate 1 paid probe: exactly one fixed purchase (a $0.005 cyberwarex screenshot of our own site). The URL is not an
// input, so this route cannot be used to buy anything else. Bearer CRON_SECRET; the caller supplies the idempotency key
// so a retry never pays twice.
const TARGET = "https://web.cyberwarex.com/screenshot?url=https%3A%2F%2Ftendr-ecru.vercel.app&fullpage=false&width=1280";

export async function POST(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected || req.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const key = new URL(req.url).searchParams.get("key") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(key)) return NextResponse.json({ error: "idempotency key (uuid) required as ?key=" }, { status: 400 });
  const started = Date.now();
  try {
    const result = await runKpass(["session", "execute", "--url", TARGET, "--method", "GET", "--headers", JSON.stringify({ "X-No-Advert": "1" }), "--idempotency-key", key, "--no-browser"], 290_000);
    return NextResponse.json({ exitCode: result.exitCode, durationMs: Date.now() - started, ...sanitizeExecute(result.json) });
  } catch (e) {
    const known = e instanceof KpassUnavailableError;
    return NextResponse.json({ ok: false, error: known ? (e as Error).message : "kpass failed to start" }, { status: 503 });
  }
}
