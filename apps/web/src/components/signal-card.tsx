import type { Signal } from "@tenderhound/core";

const LABELS: Record<Signal["id"], string> = {
  S1_SHORT_DEADLINE: "Short deadline",
  S2_BRAND_LOCK: "Named brand or incumbent system",
  S3_OVER_SPECIFICATION: "Over-specified requirements",
  S4_EXPERIENCE_LOCK: "Experience tied to one supplier",
  S5_PRICE_WEIGHT_LOW: "Low price weight, subjective criteria",
  S6_DISPROPORTIONATE_CONDITIONS: "Disproportionate financial conditions",
  S7_NO_LOTS_LARGE_SCOPE: "No lots across a broad scope",
  S8_UNUSUAL_NOTES: "Unusual organisational requirements",
};

const SEVERITY_TEXT: Record<Signal["severity"], string> = {
  high: "text-seal",
  medium: "text-amber",
  low: "text-tide",
  none: "text-mist",
};

export function SignalCard({ signal }: { signal: Signal }) {
  return (
    <article
      data-fired={signal.fired ? "true" : "false"}
      data-severity={signal.severity}
      className={`border-t border-rule py-5 ${signal.fired ? "" : "opacity-60"}`}
    >
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h3 className="text-lg">{LABELS[signal.id]}</h3>
        <span className={`text-sm font-medium ${SEVERITY_TEXT[signal.severity]}`}>{signal.fired ? signal.severity : "not detected"}</span>
        <code className="ml-auto text-xs text-mist">{signal.id}</code>
      </div>
      <p className="mt-2 max-w-[70ch] text-[0.95rem] leading-relaxed text-slate">{signal.reason}</p>
      {signal.fired && signal.evidence.length > 0 && (
        <div className="mt-3 space-y-2">
          {signal.evidence.map((quote, i) => (
            <blockquote key={i} className="exhibit">
              <span lang="pl">{quote}</span>
              <span className="ml-2 align-middle text-xs text-moss" title="This quote was verified to appear verbatim in the notice">
                verbatim ✓
              </span>
            </blockquote>
          ))}
        </div>
      )}
    </article>
  );
}
