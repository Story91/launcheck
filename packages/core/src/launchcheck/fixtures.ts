// Fixture reports served by the LaunchCheck API in fixture mode (ids fx_*). Ported from the UI mocks so both sides
// render the same cases. Content is illustrative: "example" hashes and hosts are not measurements.
import type { AgentStatus, Catalog, GalleryItem, LaunchCheckReport } from "./types";
import { NOT_CHECKED_DEFAULTS } from "./wording";

type Report = LaunchCheckReport;
export const LAUNCHCHECK_FIXTURE_IDS = ["fx_problems", "fx_clean", "fx_unreachable", "fx_running", "fx_fixed"] as const;
const at = "2026-11-06T14:02:00.000Z";
export const launchCheckFixtureCatalog: Catalog = { tiers: [{ id: "quick", label: "Quick", budgetUsd: 0.05 }, { id: "standard", label: "Standard", budgetUsd: 0.15, default: true }, { id: "full", label: "Full", budgetUsd: 0.25 }], checks: [
  { checkId: "page_fetch", label: "Page response", kind: "free", priceUsd: 0 },
  { checkId: "render_desktop", label: "Desktop render", kind: "paid", priceUsd: 0.005, vendorHost: "web.cyberwarex.com", tiers: ["quick", "standard", "full"] },
  { checkId: "render_narrow", label: "390 px render", kind: "paid", priceUsd: 0.005, vendorHost: "web.cyberwarex.com", tiers: ["quick", "standard", "full"] },
  { checkId: "rendered_links", label: "Rendered links", kind: "paid", priceUsd: 0.01, vendorHost: "vaaya.ai", tiers: ["quick", "standard", "full"] },
  { checkId: "html_audit", label: "Static HTML second opinion", kind: "paid", priceUsd: 0.08, vendorHost: "api.kadec0.xyz", tiers: ["standard", "full"] },
  { checkId: "render_clean", label: "Render with popups hidden", kind: "paid", priceUsd: 0.02, vendorHost: "screenshots.underscoredone.com", tiers: ["full"] },
] };
export const launchCheckFixtureAgent: AgentStatus = { agent: { kiteAgentId: "example-agent", agentType: "claude", ownerMasked: "de***@example", registeredAt: at }, allowance: { leftUsd: 6.42, limitUsd: 10, period: "weekly", resetsAt: "2026-11-13T01:33:00Z", readAt: at }, demo: { capUsd: 1.5, leftUsd: 1.12, resetsAt: "2026-11-07T00:00:00Z" }, executor: { online: true, lastSeenAt: at, where: "example" }, liveRuns: false };
export function launchCheckFixtureReport(id: string, phase = 5): Report {
  const unreachable = id === "fx_unreachable"; const clean = id === "fx_clean" || id === "fx_fixed"; const active = id === "fx_running" && phase < 5;
  const stages = ["queued", "prechecking", "planning", "buying", "explaining", "done"] as const;
  const bought = unreachable ? [] : launchCheckFixtureCatalog.checks.filter(c => c.kind === "paid" && c.tiers?.includes("standard")).slice(0, active ? Math.max(0, phase - 2) : 4);
  const lines: Report["receipt"]["lines"] = bought.map((c, i) => ({ n: i + 1, checkId: c.checkId, label: c.label, vendorHost: c.vendorHost!, endpoint: "/example", quotedUsd: c.priceUsd, paidUsd: c.priceUsd, source: "allowance", status: "paid", httpStatus: 200, txHash: null, explorerUrl: null, idempotencyKeyShort: `example-${i}`, at, substitutedFor: null }));
  const spentUsd = Number(lines.reduce((sum, line) => sum + line.paidUsd, 0).toFixed(3));
  const evidence: Report["evidence"] = unreachable || phase < 3 ? [] : [
    { id: "ev_desktop", checkId: "render_desktop", kind: "image", label: "Example capture: Tendr desktop", blobUrl: "/images/launchcheck-demo-desktop.png", sha256: "example-not-a-measured-hash", capturedAt: at, source: { type: "paid", vendorHost: "web.cyberwarex.com", endpoint: "/screenshot" }, scopeNote: "Illustrative capture of our Tendr site. The findings below are fixtures, not measurements of this screenshot.", fields: { width: 1280 } },
    { id: "ev_narrow", checkId: "render_narrow", kind: "image", label: "Example capture: Tendr at 390 px", blobUrl: "/images/launchcheck-demo-mobile.png", sha256: "example-not-a-measured-hash", capturedAt: at, source: { type: "paid", vendorHost: "web.cyberwarex.com", endpoint: "/screenshot" }, scopeNote: "390px-wide browser window. Not a phone: no touch, no mobile user agent, no device emulation.", fields: { width: 390 } },
    { id: "ev_share", checkId: "share_tags", kind: "json", label: "Example link preview tags", blobUrl: null, sha256: "example-not-a-measured-hash", capturedAt: at, source: { type: "free", vendorHost: null, endpoint: null }, scopeNote: "Static HTML only", fields: { ogTitle: "Example launch", ogImage: clean ? "https://example.com/og.png" : null, twitterCard: clean ? "summary_large_image" : null } },
    { id: "ev_links", checkId: "link_status", kind: "json", label: "Example link responses", blobUrl: null, sha256: "example-not-a-measured-hash", capturedAt: at, source: { type: "free", vendorHost: null, endpoint: null }, scopeNote: "Checked 2 of 12 links in this example", fields: { links: [{ url: "https://example.com/pricing", status: clean ? 200 : 404 }] } },
  ];
  const checks: Report["checks"] = [
    { checkId: "page_fetch", label: "Page response", kind: "free", state: "clear", notCheckedReason: null, evidenceIds: [], scopeNote: "Homepage HTTP response only" },
    { checkId: "render_desktop", label: "Desktop render (1280 px)", kind: "paid", state: "clear", notCheckedReason: null, evidenceIds: ["ev_desktop"], scopeNote: "Appearance only; no interaction test" },
    { checkId: "render_narrow", label: "Narrow render (390 px)", kind: "paid", state: "clear", notCheckedReason: null, evidenceIds: ["ev_narrow"], scopeNote: "390 px browser window, not a phone" },
    { checkId: "share_tags", label: "Link preview tags", kind: "free", state: clean ? "clear" : "problem", notCheckedReason: null, evidenceIds: ["ev_share"], scopeNote: "Static HTML only" },
    { checkId: "link_status", label: "Selected links", kind: "free", state: clean ? "clear" : "problem", notCheckedReason: null, evidenceIds: ["ev_links"], scopeNote: "Checked 2 of 12 example links" },
    { checkId: "html_audit", label: "Static HTML second opinion", kind: "paid", state: "clear", notCheckedReason: null, evidenceIds: [], scopeNote: "Static HTML analysis, not Lighthouse" },
    { checkId: "outside_probe", label: "External link probe", kind: "paid", state: "not_checked", notCheckedReason: "vendor_error", evidenceIds: [], scopeNote: null },
  ];
  if (unreachable) checks.forEach(c => { c.state = "not_checked"; c.notCheckedReason = "timeout"; c.evidenceIds = []; });
  if (active) checks.forEach((c, i) => { if (i >= phase) { c.state = i === phase ? "running" : "pending"; c.evidenceIds = []; } });
  const findings: Report["findings"] = clean || unreachable || active ? [] : [
    { id: "f_og", ruleId: "og_image_missing", checkId: "share_tags", severity: "fix_before_launch", title: "Link preview has no image", observed: "No og:image tag in the example HTML.", evidenceIds: ["ev_share"], explanation: "The captured tags do not supply a picture for a link preview. Platforms may apply their own fallbacks.", fix: "Add an absolute HTTPS og:image URL and inspect the fetched HTML again.", explainedBy: "template" },
    { id: "f_link", ruleId: "link_broken", checkId: "link_status", severity: "fix_before_launch", title: "The pricing link returns 404", observed: "HTTP 404 for https://example.com/pricing in this fixture.", evidenceIds: ["ev_links"], explanation: "A visitor following this link would not reach the intended page in this example.", fix: "Publish the pricing page or update the link to an existing destination.", explainedBy: "template" },
  ];
  return { id, url: "https://example.com/", origin: "https://example.com", status: unreachable ? "unreachable" : active ? (stages[phase] ?? "done") : "done", progress: unreachable ? "unreachable" : (stages[Math.min(phase, 5)] ?? "done"), tier: "standard", mode: "allowance", budgetUsd: 0.15, spentUsd, createdAt: at, finishedAt: active ? null : at, parentId: id === "fx_fixed" ? "fx_problems" : null, isRequester: false, cached: false,
    summary: { checksRun: checks.filter(c => c.state === "clear" || c.state === "problem").length, problems: findings.length, nothingFound: checks.filter(c => c.state === "clear").length, notChecked: checks.filter(c => c.state === "not_checked").length },
    plan: phase < 2 || unreachable ? null : { buy: launchCheckFixtureCatalog.checks.filter(c => c.kind === "paid" && c.tiers?.includes("standard")).map(c => ({ checkId: c.checkId, label: c.label, vendorHost: c.vendorHost!, priceUsd: c.priceUsd, reason: "Example plan: collect browser evidence and a second opinion within the limit." })), skip: [{ checkId: "render_clean", label: "Popup-hidden render", priceUsd: 0.02, reason: "Outside the selected example tier." }], plannedUsd: 0.1, chosenBy: "fixture" }, checks, evidence, findings,
    receipt: { lines, totalPaidUsd: spentUsd, budgetUsd: 0.15, stoppedBy: null, freeChecks: unreachable ? 0 : 3 }, agent: { kiteAgentId: "example-agent", agentType: "claude", ownerMasked: "de***@example", network: "Base mainnet (eip155:8453)", asset: "USDC" }, audit: [], notChecked: [...NOT_CHECKED_DEFAULTS], diff: id === "fx_fixed" ? { parentId: "fx_problems", parentCheckedAt: "2026-11-05T14:00:00Z", fixed: ["f_og", "f_link"], stillThere: [], new: [] } : null, error: unreachable ? "The example website did not respond. No paid services were purchased." : null };
}

export function isLaunchCheckFixtureId(id: string): id is (typeof LAUNCHCHECK_FIXTURE_IDS)[number] {
  return (LAUNCHCHECK_FIXTURE_IDS as readonly string[]).includes(id);
}

export const launchCheckFixtureGallery: { items: GalleryItem[] } = {
  items: (["fx_problems", "fx_fixed", "fx_clean"] as const).map((id) => {
    const r = launchCheckFixtureReport(id);
    return { id, origin: r.origin, checkedAt: r.finishedAt ?? r.createdAt, summary: r.summary, spentUsd: r.spentUsd, thumbUrl: null, fixed: id === "fx_fixed" };
  }),
};
