import { z } from "zod";

export const SIGNAL_IDS = [
  "S1_SHORT_DEADLINE",
  "S2_BRAND_LOCK",
  "S3_OVER_SPECIFICATION",
  "S4_EXPERIENCE_LOCK",
  "S5_PRICE_WEIGHT_LOW",
  "S6_DISPROPORTIONATE_CONDITIONS",
  "S7_NO_LOTS_LARGE_SCOPE",
  "S8_UNUSUAL_NOTES",
] as const;
export const SignalId = z.enum(SIGNAL_IDS);
export type SignalId = z.infer<typeof SignalId>;

export const Severity = z.enum(["none", "low", "medium", "high"]);
export type Severity = z.infer<typeof Severity>;

export const SEVERITY_POINTS = { none: 0, low: 5, medium: 12, high: 25 } as const satisfies Record<Severity, number>;

export const TenderFacts = z.object({
  buyer: z.string(),
  title: z.string(),
  cpv: z.array(z.string()),
  estimatedValue: z.string().nullable(),
  currency: z.string().nullable(),
  deadlineForTenders: z.string().nullable(),
  publicationDate: z.string().nullable(),
  daysToDeadline: z.number().nullable(),
  procedureType: z.string().nullable(),
  lots: z.number().nullable(),
  awardCriteria: z.array(z.object({ name: z.string(), weight: z.string().nullable() })),
  participationConditions: z.array(z.string()),
  technicalRequirements: z.array(z.string()),
  brandOrProductNames: z.array(z.string()),
  equivalenceClausePresent: z.boolean(),
  incumbentSystemMentioned: z.string().nullable(),
  contractDuration: z.string().nullable(),
  notes: z.array(z.string()),
  noticeLanguage: z.string(),
});
export type TenderFacts = z.infer<typeof TenderFacts>;

export const Signal = z.object({
  id: SignalId,
  fired: z.boolean(),
  severity: Severity,
  reason: z.string(),
  evidence: z.array(z.string()),
});
export type Signal = z.infer<typeof Signal>;

export const AuditEntry = z.object({
  step: z.string(),
  model: z.string(),
  promptVersion: z.string(),
  requestId: z.string().nullable(),
  inputHash: z.string(),
  usage: z.object({ promptTokens: z.number(), completionTokens: z.number() }),
  costUsd: z.number().nullable(),
  durationMs: z.number(),
  note: z.string().optional(),
});
export type AuditEntry = z.infer<typeof AuditEntry>;

export const REPORT_STATUSES = [
  "generating",
  "pending_verification",
  "verified",
  "disputed",
  "withheld",
  "unverified",
  "failed",
] as const;
export const ReportStatus = z.enum(REPORT_STATUSES);
export type ReportStatus = z.infer<typeof ReportStatus>;

export const ReppoVerdict = z.object({
  evalId: z.string(),
  /** True when the verdict came from Reppo's free sandbox lane (placeholder, not an independent review). */
  sandbox: z.boolean().optional(),
  /** Consecutive failed polls of a pending evaluation (worker bookkeeping). */
  pollFailures: z.number().optional(),
  status: z.enum(["PENDING", "SETTLED", "FAILED"]),
  score: z.number().nullable(),
  decision: z.enum(["accept", "revise", "reject"]).nullable(),
  confidence: z.string().nullable(),
  critique: z.string().nullable(),
  evidenceBasis: z.string().nullable(),
  submittedAt: z.string(),
  settledAt: z.string().nullable(),
});
export type ReppoVerdict = z.infer<typeof ReppoVerdict>;

export const Report = z.object({
  noticeId: z.string(),
  status: ReportStatus,
  noticeLanguage: z.string().nullable(),
  buyerPlatform: z.string().nullable(),
  facts: TenderFacts.nullable(),
  signals: z.array(Signal),
  riskScore: z.number(),
  summary: z.string().nullable(),
  reppo: ReppoVerdict.nullable(),
  audit: z.array(AuditEntry),
  costUsd: z.number(),
  droppedEvidence: z.number(),
  /** Some signal groups could not be evaluated; never sellable. */
  partial: z.boolean().default(false),
  error: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Report = z.infer<typeof Report>;
