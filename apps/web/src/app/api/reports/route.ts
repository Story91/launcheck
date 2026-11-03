import { isValidNoticeId } from "@tenderhound/core";
import { after, NextResponse } from "next/server";
import { buildPipelineDeps } from "@/lib/deps";
import { STALE_GENERATION_MS, startGeneration } from "@/lib/reports";
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
  const fresh = existing && existing.status === "generating" && Date.now() - new Date(existing.updatedAt).getTime() < STALE_GENERATION_MS;
  if (existing && (fresh || (existing.status !== "failed" && existing.status !== "generating"))) {
    return NextResponse.json({ noticeId, status: existing.status, progress: existing.progress }, { status: 200 });
  }
  // startGeneration claims atomically; a losing concurrent request simply gets "exists" inside after().
  after(async () => {
    try {
      await startGeneration(noticeId, store, buildPipelineDeps());
    } catch (e) {
      console.error("generation crashed", e);
    }
  });
  return NextResponse.json({ noticeId, status: "generating", progress: "queued" }, { status: 202 });
}
