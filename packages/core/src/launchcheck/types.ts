// LaunCheck API contract (frozen 7 Nov 2026). Mirrors docs/launchcheck/codex-tasks.md; the UI validates every
// response against these schemas. Change only through docs/coordination.md.
import { z } from "zod";

const amount = z.number().finite().nonnegative();

export const tierSchema = z.enum(["quick", "standard", "full"]);
export const venueSchema = z.enum(["product_hunt", "show_hn", "x", "other"]);
export const runStatusSchema = z.enum(["queued", "prechecking", "planning", "buying", "explaining", "done", "failed", "unreachable"]);
export const checkStateSchema = z.enum(["pending", "running", "problem", "clear", "not_checked"]);
export const notCheckedReasonSchema = z.enum(["over_budget", "not_selected", "vendor_error", "timeout", "payment_unknown", "not_applicable", "kite_refused", "blocked_from_our_server"]);
export const severitySchema = z.enum(["fix_before_launch", "fix_soon", "fyi"]);
export const receiptStatusSchema = z.enum(["paid", "skipped_budget", "failed_not_charged", "failed_charged", "payment_unknown", "refused_by_kite"]);
export const stoppedBySchema = z.enum(["our_cap", "kite_policy", "allowance_empty"]);

export const summarySchema = z.object({
  checksRun: z.number().int().nonnegative(),
  problems: z.number().int().nonnegative(),
  nothingFound: z.number().int().nonnegative(),
  notChecked: z.number().int().nonnegative(),
});

export const launchCheckEvidenceSchema = z.object({
  id: z.string(),
  checkId: z.string(),
  kind: z.enum(["image", "json", "text"]),
  label: z.string(),
  blobUrl: z.string().nullable(),
  sha256: z.string(),
  capturedAt: z.string(),
  source: z.object({ type: z.enum(["free", "paid"]), vendorHost: z.string().nullable(), endpoint: z.string().nullable() }),
  scopeNote: z.string().nullable(),
  fields: z.record(z.unknown()),
});

export const receiptLineSchema = z.object({
  n: z.number(),
  checkId: z.string(),
  label: z.string(),
  vendorHost: z.string(),
  endpoint: z.string(),
  quotedUsd: amount,
  requestUrl: z.string().optional(),
  paidUsd: amount,
  source: z.enum(["allowance", "session", "unknown"]),
  status: receiptStatusSchema,
  httpStatus: z.number().nullable(),
  txHash: z.string().nullable(),
  explorerUrl: z.string().nullable(),
  idempotencyKeyShort: z.string().nullable(),
  at: z.string(),
  substitutedFor: z.string().nullable(),
});

export const launchCheckPlanSchema = z.object({
  buy: z.array(z.object({ checkId: z.string(), label: z.string(), vendorHost: z.string(), priceUsd: amount, reason: z.string() })),
  skip: z.array(z.object({ checkId: z.string(), label: z.string(), priceUsd: amount, reason: z.string() })),
  plannedUsd: amount,
  chosenBy: z.string(),
});

export const launchCheckCheckSchema = z.object({
  checkId: z.string(),
  label: z.string(),
  kind: z.enum(["free", "paid"]),
  state: checkStateSchema,
  notCheckedReason: notCheckedReasonSchema.nullable(),
  evidenceIds: z.array(z.string()),
  scopeNote: z.string().nullable(),
});

export const launchCheckFindingSchema = z.object({
  id: z.string(),
  ruleId: z.string(),
  checkId: z.string(),
  severity: severitySchema,
  title: z.string(),
  observed: z.string(),
  evidenceIds: z.array(z.string()),
  explanation: z.string(),
  fix: z.string(),
  explainedBy: z.enum(["serv", "template"]),
});

export const launchCheckReportSchema = z.object({
  id: z.string(),
  url: z.string(),
  origin: z.string(),
  status: runStatusSchema,
  progress: z.string(),
  tier: tierSchema,
  mode: z.enum(["allowance", "session"]),
  budgetUsd: amount,
  spentUsd: amount,
  createdAt: z.string(),
  finishedAt: z.string().nullable(),
  parentId: z.string().nullable(),
  isRequester: z.boolean(),
  cached: z.boolean(),
  summary: summarySchema,
  plan: launchCheckPlanSchema.nullable(),
  checks: z.array(launchCheckCheckSchema),
  evidence: z.array(launchCheckEvidenceSchema),
  findings: z.array(launchCheckFindingSchema),
  receipt: z.object({
    lines: z.array(receiptLineSchema),
    totalPaidUsd: amount,
    budgetUsd: amount,
    stoppedBy: stoppedBySchema.nullable(),
    freeChecks: z.number().int().nonnegative(),
  }),
  agent: z.object({ kiteAgentId: z.string(), agentType: z.string(), ownerMasked: z.string(), network: z.string(), asset: z.string() }),
  audit: z.array(z.object({
    step: z.string(),
    model: z.string(),
    promptVersion: z.string(),
    requestId: z.string().nullable(),
    consoleUrl: z.string().nullable(),
    inputHash: z.string(),
    costUsd: amount.nullable(),
    droppedItems: z.number(),
    refused: z.boolean(),
  })),
  notChecked: z.array(z.string()),
  diff: z.object({ parentId: z.string(), parentCheckedAt: z.string(), fixed: z.array(z.string()), stillThere: z.array(z.string()), unresolved: z.array(z.string()).optional(), new: z.array(z.string()) }).nullable(),
  error: z.string().nullable().optional(),
});

export const catalogSchema = z.object({
  tiers: z.array(z.object({ id: tierSchema, budgetUsd: amount, label: z.string(), default: z.boolean().optional() })).min(1),
  checks: z.array(z.object({
    checkId: z.string(),
    label: z.string(),
    kind: z.enum(["free", "paid"]),
    priceUsd: amount,
    vendorHost: z.string().optional(),
    tiers: z.array(tierSchema).optional(),
  })),
});

export const agentStatusSchema = z.object({
  agent: z.object({ kiteAgentId: z.string(), agentType: z.string(), ownerMasked: z.string(), registeredAt: z.string() }),
  allowance: z.object({ leftUsd: amount, limitUsd: amount, period: z.string(), resetsAt: z.string(), readAt: z.string() }).nullable(),
  demo: z.object({ capUsd: amount, leftUsd: amount, resetsAt: z.string() }),
  executor: z.object({ online: z.boolean(), lastSeenAt: z.string().nullable(), where: z.string() }),
  liveRuns: z.boolean(),
});

export const galleryItemSchema = z.object({
  id: z.string(),
  origin: z.string(),
  checkedAt: z.string(),
  summary: summarySchema,
  spentUsd: amount,
  thumbUrl: z.string().nullable(),
  fixed: z.boolean(),
  paymentUnknown: z.boolean().optional(),
});
export const gallerySchema = z.object({ items: z.array(galleryItemSchema) });

/** POST /api/checks and POST /api/checks/[id]/rerun success bodies. */
export const checkCreatedSchema = z.object({
  id: z.string().min(1),
  reportUrl: z.string().optional(),
  cached: z.boolean().optional(),
  checkedAt: z.string().optional(),
  rerunEstimateUsd: z.number().optional(),
  estimateUsd: z.number().optional(),
});

/** Error bodies of the LaunCheck API (HTTP 400/403/429/503). */
export const launchCheckErrorSchema = z.discriminatedUnion("error", [
  z.object({ error: z.literal("invalid_url") }),
  z.object({ error: z.literal("blocked_url"), reason: z.string() }),
  z.object({ error: z.literal("rate_limited"), retryAfterSec: z.number() }),
  z.object({ error: z.literal("live_runs_paused"), reason: z.enum(["daily_cap", "executor_offline", "paused", "allowance_low"]), galleryUrl: z.string() }),
  z.object({ error: z.literal("not_found") }),
]);

export type LaunchCheckTier = z.infer<typeof tierSchema>;
export type LaunchCheckVenue = z.infer<typeof venueSchema>;
export type LaunchCheckRunStatus = z.infer<typeof runStatusSchema>;
export type LaunchCheckEvidence = z.infer<typeof launchCheckEvidenceSchema>;
export type LaunchCheckFinding = z.infer<typeof launchCheckFindingSchema>;
export type LaunchCheckCheck = z.infer<typeof launchCheckCheckSchema>;
export type LaunchCheckPlan = z.infer<typeof launchCheckPlanSchema>;
export type ReceiptLine = z.infer<typeof receiptLineSchema>;
export type LaunchCheckReport = z.infer<typeof launchCheckReportSchema>;
export type Catalog = z.infer<typeof catalogSchema>;
export type AgentStatus = z.infer<typeof agentStatusSchema>;
export type GalleryItem = z.infer<typeof galleryItemSchema>;
export type Gallery = z.infer<typeof gallerySchema>;
export type CheckCreated = z.infer<typeof checkCreatedSchema>;
export type LaunchCheckError = z.infer<typeof launchCheckErrorSchema>;
