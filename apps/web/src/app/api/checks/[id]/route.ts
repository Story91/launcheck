import { fixtureReportFor, json } from "@/lib/launchcheck/fixture-mode";

export const dynamic = "force-dynamic";

/** GET a LaunchCheck report. Fixture ids (fx_*) are served from @tendr/core; real runs arrive with the executor. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = fixtureReportFor(id);
  return report ? json(report) : json({ error: "not_found" }, 404);
}
