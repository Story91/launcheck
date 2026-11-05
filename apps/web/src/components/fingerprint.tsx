import type { Signal } from "@tendr/core";

const ORDER: Signal["id"][] = [
  "S1_SHORT_DEADLINE",
  "S2_BRAND_LOCK",
  "S3_OVER_SPECIFICATION",
  "S4_EXPERIENCE_LOCK",
  "S5_PRICE_WEIGHT_LOW",
  "S6_DISPROPORTIONATE_CONDITIONS",
  "S7_NO_LOTS_LARGE_SCOPE",
  "S8_UNUSUAL_NOTES",
];
const FILL: Record<Signal["severity"], string> = { high: "var(--seal)", medium: "var(--amber)", low: "var(--tide)", none: "var(--rule)" };
const HEIGHT: Record<Signal["severity"], number> = { high: 1, medium: 0.75, low: 0.5, none: 0.17 };

/** Eight bars in fixed S1–S8 order; height and colour follow severity, so reports compare at a glance. */
export function SignalFingerprint({ signals, height = 36 }: { signals: Signal[]; height?: number }) {
  const byId = new Map(signals.map((s) => [s.id, s]));
  const fired = signals.filter((s) => s.fired).length;
  const w = Math.round(height / 4);
  return (
    <svg width={ORDER.length * (w + 3) - 3} height={height} role="img" aria-label={`${fired} of ${ORDER.length} signals detected`}>
      {ORDER.map((id, i) => {
        const s = byId.get(id);
        const sev = s?.fired ? s.severity : "none";
        const h = Math.max(4, height * HEIGHT[sev]);
        return <rect key={id} x={i * (w + 3)} y={height - h} width={w} height={h} rx={2} fill={FILL[sev]} />;
      })}
    </svg>
  );
}
