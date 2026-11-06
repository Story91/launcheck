import { isRunOwner } from "@/lib/launchcheck/owner";
import { fixtureReportFor, json } from "@/lib/launchcheck/fixture-mode";
import { runStore } from "@/lib/launchcheck/run-store";

export const dynamic = "force-dynamic";

/** GET a LaunCheck report. Fixture ids (fx_*) come from @tendr/core; real runs from the store. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fixture = fixtureReportFor(id);
  if (fixture) return json(fixture);
  const report = await runStore().getReport(id);
  if (!report) return json({ error: "not_found" }, 404);
  return json({ ...report, isRequester: await isRunOwner(req, id) });
}

/** Remove a report; only the browser that started the run may do it. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await runStore().getReport(id);
  if (!report) return json({ error: "not_found" }, 404);
  if (!(await isRunOwner(req, id))) return json({ error: "forbidden" }, 403);
  if (!["done","failed","unreachable"].includes(report.status)) return json({ error: "run_in_progress" }, 409);
  if (report.receipt.lines.some(l => l.status === "payment_unknown")) return json({ error: "payment_unresolved" }, 409);
  await runStore().deleteRun(id);
  return new Response(null, { status: 204 });
}
