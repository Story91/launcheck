import { isLaunchcheckOperator } from "@/lib/launchcheck/operator";
import { runStore } from "@/lib/launchcheck/run-store";
import { runKpass } from "@/lib/launchcheck/kpass-runtime";
import { findSettlement } from "@/lib/launchcheck/buyer";
import { today } from "@/lib/launchcheck/executor";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
/** Read-only wallet reconciliation. This endpoint never executes or retries a merchant payment. */
export async function POST(req: Request) {
  if (!isLaunchcheckOperator(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body.reportId !== "string" || !/^lc_[a-zA-Z0-9]+$/.test(body.reportId)) return Response.json({ error: "invalid_report" }, { status: 400 });
  const store = runStore(), report = await store.getReport(body.reportId);
  if (!report) return Response.json({ error: "not_found" }, { status: 404 });
  const activity = await runKpass(["activity","--kind","x402_payment","--limit","100"],30000);
  let resolved = 0;
  for (const line of report.receipt.lines) {
    if (line.status !== "payment_unknown" || !line.requestUrl) continue;
    const settlement = findSettlement(activity.json,line.requestUrl,new Date(line.at),line.txHash);
    if (!settlement) continue;
    line.paidUsd = settlement.paidUsd; line.txHash = settlement.txHash;
    line.explorerUrl = `https://basescan.org/tx/${settlement.txHash}`;
    line.source = settlement.source === "allowance" || settlement.source === "session" ? settlement.source : "unknown";
    const check = report.checks.find(c => c.checkId === line.checkId);
    line.status = check && ["clear","problem"].includes(check.state) ? "paid" : "failed_charged";
    if (check?.notCheckedReason === "payment_unknown") check.notCheckedReason = "timeout";
    resolved++;
  }
  report.spentUsd = Math.round(report.receipt.lines.reduce((n,l) => n+l.paidUsd,0)*1e6)/1e6;
  report.receipt.totalPaidUsd = report.spentUsd;
  await store.saveReport(report);
  const released = await store.releasePaymentHoldIfResolved(today());
  return Response.json({ resolved, paymentHold: !released, remainingUnknown: report.receipt.lines.filter(l => l.status === "payment_unknown").length });
}
