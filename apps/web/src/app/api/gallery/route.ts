import { featuredReport } from "@/lib/launchcheck/featured";
import { launchCheckFixtureGallery } from "@tendr/core";
import { json } from "@/lib/launchcheck/fixture-mode";

export const dynamic = "force-dynamic";

/** Curated gallery. ?fixture=1 serves examples; the real gallery is empty until the owner curates runs. */
export async function GET(req: Request) {
  const fixture = new URL(req.url).searchParams.get("fixture") === "1";
  if (fixture) return json(launchCheckFixtureGallery);
  const r = await featuredReport();
  return json({ items: r ? [{ id: r.id, origin: r.origin, checkedAt: r.finishedAt ?? r.createdAt, summary: r.summary, spentUsd: r.spentUsd, thumbUrl: r.evidence.find(e => e.kind === "image" && e.checkId === "render_desktop")?.blobUrl ?? r.evidence.find(e => e.kind === "image")?.blobUrl ?? null, fixed: !!r.diff?.fixed.length, paymentUnknown: r.receipt.lines.some(l => l.status === "payment_unknown") }] : [] });
}
