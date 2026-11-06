import { isLaunchcheckOperator } from "@/lib/launchcheck/operator";
import { createHmac } from "node:crypto";
import { after } from "next/server";
import { runStore } from "@/lib/launchcheck/run-store";
import { dailyCapUsd, executeRun, executorConfigured, queuedReport, sha256, today } from "@/lib/launchcheck/executor";
import { appOrigin } from "@/components/launchcheck/server";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
/** One idempotent owner-operated acceptance run against our own demo, without enabling public spending. */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET ?? process.env.LAUNCHCHECK_OPERATOR_TOKEN;
  if (!isLaunchcheckOperator(req) || !secret) return Response.json({ error: "unauthorized" }, { status: 401 });
  const key = req.headers.get("idempotency-key");
  if (!key || !/^[a-zA-Z0-9_-]{20,80}$/.test(key)) return Response.json({ error: "idempotency_key_required" }, { status: 400 });
  if (!executorConfigured() || !process.env.SERV_API_KEY) return Response.json({ error: "executor_or_serv_not_configured" }, { status: 503 });
  const store = runStore(); const id = `lc_${sha256(`acceptance:${key}`).slice(0,24)}`;
  const token = createHmac("sha256", secret).update(key).digest("base64url").slice(0,32);
  const existing = await store.getReport(id);
  if (!existing) {
    if (await store.getSetting("payment_hold") === "true") return Response.json({ error: "payment_hold" }, { status: 503 });
    if (await store.dailySpend(today()) + .25 > dailyCapUsd()) return Response.json({ error: "daily_cap" }, { status: 503 });
    const url = new URL("/demo/acme-launch", appOrigin()).href;
    await store.createRun(queuedReport(id,url,"full"), { ipHash: sha256("owner-acceptance"), creatorHash: sha256(token) });
    after(() => executeRun(id,url,"full"));
  }
  const response = Response.json({ id, reportUrl: `/check/${id}`, reused: !!existing, version: process.env.VERCEL_GIT_COMMIT_SHA ?? null }, { status: existing ? 200 : 201 });
  response.headers.set("set-cookie", `lc_creator=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`);
  return response;
}
