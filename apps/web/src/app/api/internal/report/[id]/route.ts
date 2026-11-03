import { NextResponse } from "next/server";
import { internalSecret } from "@/lib/deps";
import { internalReportResponse } from "@/lib/reports";
import { reportStore } from "@/lib/store";

/** Upstream for the x402 paywall service. 200 only for sellable reports; 409 otherwise (never settles payment). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const res = await internalReportResponse(reportStore(), id, req.headers.get("x-internal-secret"), internalSecret());
  return NextResponse.json(res.body, { status: res.status, headers: { "cache-control": "no-store" } });
}
