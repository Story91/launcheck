import { isLaunchcheckOperator } from "@/lib/launchcheck/operator";
import { appOrigin } from "@/components/launchcheck/server";
import { runStore } from "@/lib/launchcheck/run-store";
export const dynamic = "force-dynamic";
/** Owner-only controls for the deliberately broken, first-party demonstration page. */
export async function POST(req: Request) {
  if (!isLaunchcheckOperator(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body) || (typeof body.fixed !== "boolean" && !("featuredReportId" in body))) return Response.json({ error: "invalid_input" }, { status: 400 });
  let featured: string | undefined;
  if ("featuredReportId" in body) {
    if (body.featuredReportId === null) featured = "";
    else {
      if (typeof body.featuredReportId !== "string" || !/^lc_[a-zA-Z0-9]+$/.test(body.featuredReportId)) return Response.json({ error: "invalid_report" }, { status: 400 });
      const report = await runStore().getReport(body.featuredReportId);
      if (!report || report.status !== "done") return Response.json({ error: "report_unavailable" }, { status: 400 });
      const page = new URL(report.url), owner = new URL(appOrigin());
      if (page.origin !== owner.origin || !["/", "/demo/acme-launch"].includes(page.pathname) || page.search || page.hash) return Response.json({ error: "only_first_party_demo_can_be_featured" }, { status: 400 });
      featured = body.featuredReportId;
    }
  }
  if (typeof body.fixed === "boolean") await runStore().setSetting("demo_fixed", String(body.fixed));
  if (featured !== undefined) await runStore().setSetting("featured_report", featured);
  return Response.json({ fixed: body.fixed, featuredReportId: featured });
}
