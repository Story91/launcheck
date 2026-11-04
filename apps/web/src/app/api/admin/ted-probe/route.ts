import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Diagnostic: what does TED return to this deployment for a notice? Auth: Bearer CRON_SECRET. */
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected || req.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const id = new URL(req.url).searchParams.get("id") ?? "722731-2026";
  const url = `https://ted.europa.eu/en/notice/${id}/xml`;
  const t0 = Date.now();
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Tendr/0.1", Accept: "application/xml,text/xml;q=0.9,*/*;q=0.8" }, redirect: "manual", signal: AbortSignal.timeout(25_000) });
    const body = await res.text();
    return NextResponse.json({
      url,
      status: res.status,
      ms: Date.now() - t0,
      contentType: res.headers.get("content-type"),
      location: res.headers.get("location"),
      server: res.headers.get("server"),
      cfRay: res.headers.get("cf-ray"),
      length: body.length,
      hasContractNotice: body.includes("<ContractNotice"),
      head: body.slice(0, 400),
    });
  } catch (e) {
    return NextResponse.json({ url, error: (e as Error).message, ms: Date.now() - t0 }, { status: 502 });
  }
}
