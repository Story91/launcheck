import { isValidNoticeId } from "@tenderhound/core";
import { after, NextResponse } from "next/server";
import { buildPipelineDeps } from "@/lib/deps";
import { startGeneration } from "@/lib/reports";
import { reportStore } from "@/lib/store";

export const maxDuration = 300;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { noticeId?: string };
  const noticeId = (body.noticeId ?? "").trim();
  if (!isValidNoticeId(noticeId)) {
    return NextResponse.json({ error: "noticeId must be a TED publication number, e.g. 722731-2026" }, { status: 400 });
  }
  const store = reportStore();
  const existing = await store.get(noticeId);
  if (existing && existing.status !== "failed") {
    return NextResponse.json({ noticeId, status: existing.status, progress: existing.progress }, { status: 200 });
  }
  after(async () => {
    try {
      await startGeneration(noticeId, store, buildPipelineDeps());
    } catch (e) {
      console.error("generation crashed", e);
    }
  });
  return NextResponse.json({ noticeId, status: "generating", progress: "queued" }, { status: 202 });
}
