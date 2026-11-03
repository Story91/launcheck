import type { ReportStatus, ReppoVerdict } from "../types";

/** accept → verified, revise → disputed, reject → withheld, FAILED → unverified, PENDING → pending_verification. */
export function mapVerdictToStatus(v: ReppoVerdict): ReportStatus {
  if (v.status === "FAILED") return "unverified";
  if (v.status === "PENDING") return "pending_verification";
  switch (v.decision) {
    case "accept":
      return "verified";
    case "revise":
      return "disputed";
    case "reject":
      return "withheld";
    default:
      return "unverified";
  }
}
