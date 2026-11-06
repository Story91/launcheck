import { getPublicReport } from "@/components/launchcheck/server";
import { escapeXml, shortDate, isFixture } from "@/components/launchcheck/format";
import { copy } from "@/components/launchcheck/copy";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const result = await getPublicReport((await params).id);
  if (result.kind !== "ok") return new Response(copy.api.missing, { status: result.kind === "missing" ? 404 : 503, headers: { "Cache-Control": "no-store" } });
  const report = result.report; const at = report.finishedAt ?? report.createdAt; const old = Date.now() - new Date(at).valueOf() > 30 * 86400000;
  const label = old ? copy.oldBadge : `${isFixture(report.id) ? `${copy.fixture} / ` : ""}${report.summary.checksRun} ${copy.checks} / ${shortDate(at)} / ${copy.badgeReceipt}`;
  const width = Math.min(680, Math.max(410, 120 + label.length * 6.5));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="30" viewBox="0 0 ${width} 30" role="img" aria-label="${escapeXml(`${copy.brand}: ${label}`)}"><title>${escapeXml(`${copy.brand}: ${label}`)}</title><rect width="${width}" height="30" rx="5" fill="${old ? "#e8eceb" : "#edf2e9"}" stroke="#b7c4ba"/><path d="M5 0h112v30H5a5 5 0 0 1-5-5V5a5 5 0 0 1 5-5" fill="#274b3c"/><g font-family="Verdana,Arial,sans-serif" font-size="11"><text x="12" y="20" fill="#fff">${escapeXml(copy.brand)}</text><text x="128" y="20" fill="#31453b">${escapeXml(label)}</text></g></svg>`;
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'" } });
}
