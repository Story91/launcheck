import { showsLanguageWarning } from "@/lib/source";
import type { Report } from "@tendr/core";

export const STATUS_COPY: Record<Report["status"], { label: string; tone: string }> = {
  generating: { label: "Generating report", tone: "text-slate" },
  pending_verification: { label: "Pending independent verification", tone: "text-amber" },
  verified: { label: "Verified by Reppo", tone: "text-moss" },
  disputed: { label: "Disputed — see critique", tone: "text-amber" },
  withheld: { label: "Withheld after independent review", tone: "text-seal" },
  unverified: { label: "Verification unavailable", tone: "text-mist" },
  failed: { label: "Report failed", tone: "text-seal" },
};

export function StatusBadge({ status }: { status: Report["status"] }) {
  const { label, tone } = STATUS_COPY[status];
  return (
    <span className={`inline-flex items-center gap-2 text-sm font-medium ${tone}`}>
      <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-current" />
      {label}
    </span>
  );
}

/** 0–100 shown as a ruled bar: the memorable element of the report page. */
export function RiskMeter({ score }: { score: number }) {
  const tone = score >= 50 ? "bg-seal" : score >= 25 ? "bg-amber" : score > 0 ? "bg-tide" : "bg-mist";
  return (
    <div className="flex items-end gap-4">
      <div className="font-serif text-5xl leading-none text-ink tabular-nums">
        {score}
        <span className="text-xl text-mist">/100</span>
      </div>
      <div className="mb-1 flex-1">
        <div className="h-3 w-full border border-rule bg-paper-deep" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score} aria-label="Risk score">
          <div className={`h-full ${tone}`} style={{ width: `${score}%` }} />
        </div>
        <p className="mt-1 text-xs text-mist">Risk score: high 25 · medium 12 · low 5 per signal, capped at 100</p>
      </div>
    </div>
  );
}

export function LanguageNote({ noticeId, language }: { noticeId: string; language: string | null }) {
  if (!showsLanguageWarning(noticeId, language)) return null;
  return <p className="text-sm text-amber">Non-Polish EU notice: reduced confidence. Rules are applied under Directive 2014/24/EU; national thresholds may differ.</p>;
}
