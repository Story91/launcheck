import { isLaunchCheckFixtureId, launchCheckFixtureReport } from "@tendr/core";

// fx_running advances one phase per request (0..5, then starts over) so the UI can rehearse live progress.
const runningPhase = new Map<string, number>();

export function fixtureReportFor(id: string) {
  if (!isLaunchCheckFixtureId(id)) return null;
  if (id !== "fx_running") return launchCheckFixtureReport(id);
  const phase = runningPhase.get(id) ?? 0;
  runningPhase.set(id, phase >= 5 ? 0 : phase + 1);
  return launchCheckFixtureReport(id, phase);
}

export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });
