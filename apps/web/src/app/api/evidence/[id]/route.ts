import { runStore } from "@/lib/launchcheck/run-store";

export const dynamic = "force-dynamic";

/** Screenshot evidence bought during a run; uncached so report removal also removes access. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^lc_[A-Za-z0-9]+_ev_[a-z_]+$/.test(id)) return new Response("not found", { status: 404 });
  const png = await runStore().getImage(id);
  if (!png) return new Response("not found", { status: 404 });
  return new Response(new Uint8Array(png), { headers: { "content-type": "image/png", "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
}
