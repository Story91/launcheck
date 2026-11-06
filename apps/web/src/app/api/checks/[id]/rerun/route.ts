import { isLaunchCheckFixtureId } from "@tendr/core";
import { json } from "@/lib/launchcheck/fixture-mode";

export const dynamic = "force-dynamic";

/** Re-check only the problems of a report. Fixture: fx_problems reruns into fx_fixed. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id === "fx_problems") return json({ id: "fx_fixed", reportUrl: "/check/fx_fixed", estimateUsd: 0.03 }, 201);
  if (isLaunchCheckFixtureId(id)) return json({ error: "live_runs_paused", reason: "paused", galleryUrl: "/gallery" }, 503);
  return json({ error: "not_found" }, 404);
}
