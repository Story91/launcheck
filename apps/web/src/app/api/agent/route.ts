import { launchCheckFixtureAgent } from "@tendr/core";
import { json } from "@/lib/launchcheck/fixture-mode";

export const dynamic = "force-dynamic";

/**
 * Kite agent identity and spending state. ?fixture=1 serves the example. Without it this reports the truth: the
 * executor is not online yet, so live runs are off and no allowance reading is shown.
 */
export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get("fixture") === "1") return json(launchCheckFixtureAgent);
  return json({
    agent: { kiteAgentId: "…d523", agentType: "claude", ownerMasked: "co***@…", registeredAt: "2026-11-06T01:55:00Z" },
    allowance: null,
    demo: { capUsd: 1.5, leftUsd: 1.5, resetsAt: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + 1)).toISOString() },
    executor: { online: false, lastSeenAt: null, where: "vercel" },
    liveRuns: false,
  });
}
