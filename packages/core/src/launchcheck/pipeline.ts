import { compareReports } from "./compare";
// One LaunchCheck run end to end: free checks on our server, a budgeted purchase plan, paid checks bought through Kite,
// and a report with evidence and an itemised receipt. All I/O is injected; the report is saved after every step so the
// UI can show live progress.
import { createHash } from "node:crypto";
import { browserConnection, type BrowserJourney } from "./browser";
import type { ServReasoning } from "./serv";
import type { CheckOutcome, FreeChecksResult } from "./engine";
import { buildPaidRequest, normalizeAudit, normalizeScreenshot, paidChecksForTier, receiptStatusFor, type PaidCheck, type PaidRequest, type ReceiptStatus } from "./paid";
import type { LaunchCheckCheck, LaunchCheckEvidence, LaunchCheckFinding, LaunchCheckReport, LaunchCheckTier, ReceiptLine } from "./types";
import { NOT_CHECKED_DEFAULTS } from "./wording";

export interface BuyResult {
  exitCode: number;
  ok: boolean;
  merchantStatus: number | null;
  errorCode: string | null;
  userMessage: string | null;
  /** Merchant response body (parsed JSON), untrusted. */
  body: unknown;
  txHash: string | null;
  source: string | null;
  /** Confirmed settlement amount. null means unresolved; absent is for legacy injected test buyers. */
  paidUsd?: number | null;
}

export interface LaunchCheckPipelineDeps {
  previousReport?: LaunchCheckReport;
  reasoning?: ServReasoning;
  navigateBrowser?: (connection: string, url: string) => Promise<BrowserJourney>;
  runFree: (url: string) => Promise<FreeChecksResult>;
  buyer: (req: PaidRequest & { idempotencyKey: string }) => Promise<BuyResult>;
  /** Stores a screenshot and returns the URL the report links to. */
  saveImage: (evidenceId: string, png: Buffer) => Promise<string>;
  save: (report: LaunchCheckReport) => Promise<void>;
  /** Our own caps (per day, allowance floor); false stops buying with stoppedBy "our_cap". */
  canSpend: (amountUsd: number) => Promise<boolean>;
  settleSpend?: (reservedUsd: number, actualUsd: number | null) => Promise<void>;
  idempotencyKey: (checkId: string) => string;
  now: () => Date;
  agent: { kiteAgentId: string; agentType: string; ownerMasked: string };
}

export interface LaunchCheckInput {
  id: string;
  url: string;
  tier: LaunchCheckTier;
  budgetUsd: number;
  parentId?: string | null;
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;
const sha = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");

export function emptyReport(input: LaunchCheckInput, deps: Pick<LaunchCheckPipelineDeps, "now" | "agent">): LaunchCheckReport {
  const at = deps.now().toISOString();
  return {
    id: input.id,
    url: input.url,
    origin: new URL(input.url).origin,
    status: "queued",
    progress: "queued",
    tier: input.tier,
    mode: "allowance",
    budgetUsd: input.budgetUsd,
    spentUsd: 0,
    createdAt: at,
    finishedAt: null,
    parentId: input.parentId ?? null,
    isRequester: false,
    cached: false,
    summary: { checksRun: 0, problems: 0, nothingFound: 0, notChecked: 0 },
    plan: null,
    checks: [],
    evidence: [],
    findings: [],
    receipt: { lines: [], totalPaidUsd: 0, budgetUsd: input.budgetUsd, stoppedBy: null, freeChecks: 0 },
    agent: { ...deps.agent, network: "Base mainnet (eip155:8453)", asset: "USDC" },
    audit: [],
    notChecked: [...NOT_CHECKED_DEFAULTS],
    diff: null,
    error: null,
  };
}

function summarize(r: LaunchCheckReport): LaunchCheckReport["summary"] {
  return {
    checksRun: r.checks.filter((c) => c.state === "clear" || c.state === "problem").length,
    problems: r.findings.length,
    nothingFound: r.checks.filter((c) => c.state === "clear").length,
    notChecked: r.checks.filter((c) => c.state === "not_checked").length,
  };
}

const paidCheckEntry = (c: PaidCheck, state: LaunchCheckCheck["state"], reason: LaunchCheckCheck["notCheckedReason"] = null, evidenceIds: string[] = []): LaunchCheckCheck => ({
  checkId: c.checkId,
  label: c.label,
  kind: "paid",
  state,
  notCheckedReason: reason,
  evidenceIds,
  scopeNote: c.scopeNote,
});

export async function runLaunchCheck(input: LaunchCheckInput, deps: LaunchCheckPipelineDeps): Promise<LaunchCheckReport> {
  const r = emptyReport(input, deps);
  const step = async (status: LaunchCheckReport["status"]) => {
    r.status = status;
    r.progress = status;
    r.summary = summarize(r);
    await deps.save(r);
  };

  await step("prechecking");
  const free = await deps.runFree(input.url);
  if (free.unreachable) {
    r.error = `${free.error ?? "The page did not respond."} No paid services were purchased.`;
    r.finishedAt = deps.now().toISOString();
    await step("unreachable");
    return r;
  }
  const addOutcome = (o: CheckOutcome) => {
    r.checks.push(o.check);
    r.evidence.push(...o.evidence);
    r.findings.push(...o.findings);
  };
  free.outcomes.forEach(addOutcome);
  r.receipt.freeChecks = free.outcomes.length;

  // Plan: the tier's checks in order, while they fit the budget.
  const candidates = paidChecksForTier(input.tier);
  let buy: PaidCheck[] = [];
  let skip: PaidCheck[] = [];
  let planned = 0;
  for (const c of candidates) {
    if (round(planned + c.priceUsd) <= input.budgetUsd) {
      buy.push(c);
      planned = round(planned + c.priceUsd);
    } else skip.push(c);
  }
  let chosenBy = "rules"; let reasons: Record<string, string> = {};
  if (deps.reasoning) { const planned = await deps.reasoning.plan(r, candidates); buy = planned.buy; skip = planned.skip; reasons = planned.reasons; chosenBy = planned.usedServ ? "serv" : "rules (SERV unavailable)"; r.audit.push(planned.audit); }
  planned = round(buy.reduce((n, c) => n + c.priceUsd, 0));
  r.plan = {
    buy: buy.map((c) => ({ checkId: c.checkId, label: c.label, vendorHost: c.vendorHost, priceUsd: c.priceUsd, reason: reasons[c.checkId] ?? c.reason })),
    skip: skip.map((c) => ({ checkId: c.checkId, label: c.label, priceUsd: c.priceUsd, reason: chosenBy === "serv" ? "Not selected by the agent within this plan." : "Over budget after the essentials." })),
    plannedUsd: planned,
    chosenBy,
  };
  for (const c of buy) r.checks.push(paidCheckEntry(c, "pending"));
  for (const c of skip) r.checks.push(paidCheckEntry(c, "not_checked", chosenBy === "serv" ? "not_selected" : "over_budget"));
  await step("planning");

  await step("buying");
  let stopped: LaunchCheckReport["receipt"]["stoppedBy"] = null;
  let n = 0;
  const setCheck = (c: PaidCheck, entry: LaunchCheckCheck) => {
    const i = r.checks.findIndex((x) => x.checkId === c.checkId);
    if (i >= 0) r.checks[i] = entry;
  };
  const line = (c: PaidCheck, req: PaidRequest | null, status: ReceiptStatus | "skipped_budget", paidUsd: number, extra: Partial<ReceiptLine> = {}): ReceiptLine => ({
    n: ++n,
    checkId: c.checkId,
    label: c.label,
    vendorHost: c.vendorHost,
    endpoint: c.endpoint,
    quotedUsd: c.priceUsd,
    paidUsd,
    source: "allowance",
    status,
    httpStatus: null,
    txHash: null,
    explorerUrl: null,
    idempotencyKeyShort: null,
    at: deps.now().toISOString(),
    substitutedFor: null,
    ...extra,
  });

  for (const c of buy) {
    if (stopped) {
      r.receipt.lines.push(line(c, null, "skipped_budget", 0));
      setCheck(c, paidCheckEntry(c, "not_checked", stopped === "our_cap" ? "over_budget" : "kite_refused"));
      continue;
    }
    if (!(await deps.canSpend(c.priceUsd))) {
      stopped = "our_cap";
      r.receipt.lines.push(line(c, null, "skipped_budget", 0));
      setCheck(c, paidCheckEntry(c, "not_checked", "over_budget"));
      continue;
    }
    setCheck(c, paidCheckEntry(c, "running"));
    const req = buildPaidRequest(c.checkId, free.finalUrl ?? input.url);
    const key = deps.idempotencyKey(c.checkId);
    // Write-ahead payment record: a killed function must never imply that no money was sent.
    const payment = line(c, req, "payment_unknown", 0, { source: "unknown", requestUrl: req.url, idempotencyKeyShort: key.slice(-4) });
    r.receipt.lines.push(payment);
    await deps.save(r);
    const res = await deps.buyer({ ...req, idempotencyKey: key });
    const baseStatus = receiptStatusFor(res);
    const status = (baseStatus === "paid" || baseStatus === "failed_charged") && res.paidUsd === null ? "payment_unknown" : baseStatus;
    const charged = status === "paid" || status === "failed_charged" ? res.paidUsd ?? c.priceUsd : 0;
    Object.assign(payment, { status, paidUsd: charged,
      httpStatus: res.merchantStatus,
      txHash: res.txHash,
      explorerUrl: res.txHash ? `https://basescan.org/tx/${res.txHash}` : null,
      idempotencyKeyShort: key.slice(-4),
      source: res.source === "allowance" || res.source === "session" ? res.source : "unknown",
    });
    r.spentUsd = round(r.spentUsd + charged);
    r.receipt.totalPaidUsd = r.spentUsd;
    if (res.source === "session") r.mode = "session";
    await deps.save(r);
    await deps.settleSpend?.(c.priceUsd, status === "payment_unknown" ? null : charged);
    if (r.spentUsd > input.budgetUsd) stopped = "our_cap";

    if (status === "refused_by_kite") {
      stopped = res.errorCode === "wallet_empty" || res.errorCode === "allowance_unavailable" ? "allowance_empty" : "kite_policy";
      setCheck(c, paidCheckEntry(c, "not_checked", "kite_refused"));
    } else if (status === "payment_unknown") {
      stopped = "our_cap"; // Do not spend again while the previous charge is unresolved.
      setCheck(c, paidCheckEntry(c, "not_checked", "payment_unknown"));
    } else if (status !== "paid") {
      setCheck(c, paidCheckEntry(c, "not_checked", "vendor_error"));
    } else {
      const evidenceId = `ev_${c.checkId}`;
      const capturedAt = deps.now().toISOString();
      const source = { type: "paid" as const, vendorHost: c.vendorHost, endpoint: c.endpoint };
      if (c.checkId === "browser_navigation") {
        const connection = browserConnection(res.body);
        if (!connection || !deps.navigateBrowser) setCheck(c, paidCheckEntry(c, "not_checked", "vendor_error"));
        else {
          const journey = await deps.navigateBrowser(connection, free.finalUrl ?? input.url);
          const imageId = `${evidenceId}_screen`;
          const fields = { steps: journey.steps, linkLabel: journey.linkLabel, error: journey.error, width: 1280 };
          r.evidence.push({ id: evidenceId, checkId: c.checkId, kind: "json", label: c.label, blobUrl: null, sha256: sha(JSON.stringify(fields)), capturedAt, source, scopeNote: c.scopeNote, fields });
          const ids = [evidenceId];
          if (journey.png) { const blobUrl = await deps.saveImage(imageId, journey.png); r.evidence.push({ id: imageId, checkId: c.checkId, kind: "image", label: "Browser navigation result", blobUrl, sha256: sha(journey.png), capturedAt, source, scopeNote: c.scopeNote, fields: { width: 1280 } }); ids.push(imageId); }
          const failed = journey.steps.find(s => s.httpStatus !== null && s.httpStatus >= 400);
          if (failed) {
            const existing = r.findings.find(f => f.ruleId === "link_broken" && f.observed.includes(failed.url));
            if (existing) existing.evidenceIds = [...new Set([...existing.evidenceIds, ...ids])];
            else r.findings.push({ id: "f_browser_navigation_http", ruleId: "browser_navigation_http_error", checkId: c.checkId, severity: "fix_before_launch", title: "Browser navigation returned an HTTP error", observed: `HTTP ${failed.httpStatus} while navigating to ${failed.url}.`, evidenceIds: ids, explanation: "A visitor following this public navigation route receives an HTTP error.", fix: "Inspect the route and link destination, then repeat this navigation check.", explainedBy: "template" });
            setCheck(c, paidCheckEntry(c, "problem", null, ids));
          } else setCheck(c, paidCheckEntry(c, journey.error || journey.steps.length < 2 || journey.steps.at(-1)?.httpStatus === null ? "not_checked" : "clear", journey.error || journey.steps.length < 2 || journey.steps.at(-1)?.httpStatus === null ? "not_applicable" : null, ids));
        }
      } else if (c.checkId === "html_audit") {
        const audit = normalizeAudit(res.body, evidenceId);
        if (!audit) setCheck(c, paidCheckEntry(c, "not_checked", "vendor_error"));
        else {
          const ev: LaunchCheckEvidence = { id: evidenceId, checkId: c.checkId, kind: "json", label: c.label, blobUrl: null, sha256: sha(JSON.stringify(audit.fields)), capturedAt, source, scopeNote: c.scopeNote, fields: audit.fields };
          r.evidence.push(ev);
          r.findings.push(...(audit.findings as LaunchCheckFinding[]));
          setCheck(c, paidCheckEntry(c, audit.findings.length ? "problem" : "clear", null, [evidenceId]));
        }
      } else {
        const shot = normalizeScreenshot(res.body);
        if (!shot) setCheck(c, paidCheckEntry(c, "not_checked", "vendor_error"));
        else {
          const blobUrl = await deps.saveImage(evidenceId, shot.png);
          r.evidence.push({ id: evidenceId, checkId: c.checkId, kind: "image", label: c.label, blobUrl, sha256: sha(shot.png), capturedAt, source, scopeNote: c.scopeNote, fields: shot.fields });
          // A render is evidence for a human to look at; no automatic finding.
          setCheck(c, paidCheckEntry(c, "clear", null, [evidenceId]));
        }
      }
    }
    r.receipt.totalPaidUsd = r.spentUsd;
    await deps.save(r);
  }

  await step("explaining");
  if (deps.reasoning) { const explained = await deps.reasoning.explain(r); r.findings = explained.findings; r.audit.push(explained.audit); }
  r.receipt.stoppedBy = stopped;
  r.receipt.totalPaidUsd = r.spentUsd;
  r.finishedAt = deps.now().toISOString();
  if (deps.previousReport) r.diff = compareReports(deps.previousReport, { ...r, status: "done" });
  await step("done");
  return r;
}
