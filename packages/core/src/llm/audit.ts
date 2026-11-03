import { createHash } from "node:crypto";
import type { AuditEntry } from "../types";
import type { ChatResult } from "./types";

export function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function makeAudit(step: string, promptVersion: string, input: string, res: ChatResult, note?: string): AuditEntry {
  return {
    step,
    model: res.model,
    promptVersion,
    requestId: res.requestId,
    inputHash: sha256(input),
    usage: { ...res.usage },
    costUsd: res.costUsd,
    durationMs: res.durationMs,
    ...(note !== undefined ? { note } : {}),
  };
}
