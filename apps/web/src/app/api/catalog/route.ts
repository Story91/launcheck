import { launchCheckFixtureCatalog } from "@tendr/core";
import { json } from "@/lib/launchcheck/fixture-mode";

export const dynamic = "force-dynamic";

/** Tiers and the check menu with prices. Served from the fixture catalog until the registry has probed prices. */
export async function GET() {
  return json(launchCheckFixtureCatalog);
}
