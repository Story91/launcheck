"use client";

import type { NoticeSummary, Signal } from "@tendr/core";
import Link from "next/link";
import { useMemo, useState } from "react";
import { SignalFingerprint } from "@/components/fingerprint";
import { noticeSource } from "@/lib/source";

export type MarketItem = NoticeSummary & { analysis: { riskScore: number; signals: Signal[] } | null };

const FILTERS = ["All", "Analyzed", "High risk", "Closing soon"] as const;
type Filter = (typeof FILTERS)[number];
const WEEK_MS = 7 * 24 * 3600 * 1000;

export function filterItems(items: MarketItem[], f: Filter, now = Date.now()): MarketItem[] {
  switch (f) {
    case "Analyzed":
      return items.filter((i) => i.analysis);
    case "High risk":
      return items.filter((i) => (i.analysis?.riskScore ?? 0) >= 50);
    case "Closing soon":
      return items.filter((i) => i.deadline && Date.parse(i.deadline) - now < WEEK_MS && Date.parse(i.deadline) >= now);
    default:
      return items;
  }
}

function scoreTone(score: number): string {
  return score >= 50 ? "text-seal" : score >= 25 ? "text-amber" : "text-tide";
}

const SUBTITLE = {
  "SAM.gov": "Live from SAM.gov · federal IT solicitations · NAICS 5415 and 5182 · last 30 days",
  TED: "Live from TED · EU IT notices · CPV 72 · last 30 days",
} as const;

export function TenderMarket({ items, source }: { items: MarketItem[]; source: "SAM.gov" | "TED" }) {
  const [filter, setFilter] = useState<Filter>("All");
  const shown = useMemo(() => filterItems(items, filter), [items, filter]);

  return (
    <section>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-sans! text-3xl font-bold tracking-tight">Open tenders</h2>
          <p className="mt-1 text-slate">{SUBTITLE[source]}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm" role="group" aria-label="Filter tenders">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1.5 ${filter === f ? "bg-ink text-paper" : "bg-paper-deep text-slate hover:text-ink"}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="mt-6 text-sm text-mist">
          {items.length === 0 ? `${source} returned no recent notices. Paste a link above instead.` : "No tenders match this filter yet."}
        </p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((n) => (
            <li key={n.noticeId}>
              <Link
                href={`/report/${n.noticeId}`}
                className="group flex h-full flex-col gap-2 rounded-2xl border border-rule bg-white p-5 transition-colors hover:border-ink"
              >
                <span className="text-xs text-mist">{n.buyer}</span>
                <span className="line-clamp-2 min-h-[2.75rem] font-sans font-semibold text-ink">{n.title.replace(/^[^–]*–[^–]*–\s*/, "")}</span>
                <span className="text-sm text-slate">
                  {noticeSource(n.noticeId, null).label}
                  {n.deadline && ` · due ${n.deadline.slice(0, 10)}`}
                </span>
                <span className="mt-auto flex items-end justify-between border-t border-dashed border-rule pt-3">
                  {n.analysis ? (
                    <>
                      <SignalFingerprint signals={n.analysis.signals} />
                      <span className={`font-sans text-3xl font-extrabold leading-none tabular-nums ${scoreTone(n.analysis.riskScore)}`}>
                        {n.analysis.riskScore}
                        <span className="text-xs font-normal text-mist">/100</span>
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-sm text-mist">Not analyzed yet</span>
                      <span className="rounded-full bg-ink px-3.5 py-2 text-sm text-paper group-hover:bg-slate">+ Analyze</span>
                    </>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-mist">
        Free in the browser. Agents buy the same report for $0.50 per call via x402 — <Link href="/api-docs" className="underline underline-offset-2">API docs</Link>.
      </p>
    </section>
  );
}
