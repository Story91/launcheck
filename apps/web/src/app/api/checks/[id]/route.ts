import { sha256 } from "@/lib/launchcheck/executor";
import { fixtureReportFor, json } from "@/lib/launchcheck/fixture-mode";
import { runStore } from "@/lib/launchcheck/run-store";

export const dynamic = "force-dynamic";

const creatorToken = (req: Request) => /(?:^|;\s*)lc_creator=([^;]+)/.exec(req.headers.get("cookie") ?? "")?.[1] ?? null;

async function isRequester(req: Request, id: string) {
  const token = creatorToken(req);
  if (!token) return false;
  return (await runStore().creatorHash(id)) === sha256(token);
}

/** GET a LaunchCheck report. Fixture ids (fx_*) come from @tendr/core; real runs from the store. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fixture = fixtureReportFor(id);
  if (fixture) return json(fixture);
  const report = await runStore().getReport(id);
  if (!report) return json({ error: "not_found" }, 404);
  return json({ ...report, isRequester: await isRequester(req, id) });
}

/** Remove a report; only the browser that started the run may do it. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await runStore().getReport(id))) return json({ error: "not_found" }, 404);
  if (!(await isRequester(req, id))) return json({ error: "forbidden" }, 403);
  await runStore().deleteRun(id);
  return new Response(null, { status: 204 });
}
