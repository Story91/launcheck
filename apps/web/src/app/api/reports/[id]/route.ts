import { NextResponse } from "next/server";
import { reportStore } from "@/lib/store";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const report = await reportStore().get(id);
  if (!report) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(report, { headers: { "cache-control": "no-store" } });
}
