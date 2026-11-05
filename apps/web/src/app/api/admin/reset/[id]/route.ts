import { NextResponse } from "next/server";
import { reportStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Deletes one report so it is generated again with the current prompts. Auth: Authorization: Bearer <CRON_SECRET>. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const expected = process.env.CRON_SECRET;
  if (!expected || req.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await reportStore().remove(id);
  return NextResponse.json({ ok: true, removed: id });
}
