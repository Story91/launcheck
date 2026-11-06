import { launchCheckFixtureGallery } from "@tendr/core";
import { json } from "@/lib/launchcheck/fixture-mode";

export const dynamic = "force-dynamic";

/** Curated gallery. ?fixture=1 serves examples; the real gallery is empty until the owner curates runs. */
export async function GET(req: Request) {
  const fixture = new URL(req.url).searchParams.get("fixture") === "1";
  return json(fixture ? launchCheckFixtureGallery : { items: [] });
}
