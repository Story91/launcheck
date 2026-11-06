"use client";

import { isSamNoticeId, type NoticeSummary, type Signal } from "@tendr/core";
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
    <section className="tender-market" aria-labelledby="market-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="market-title" className="market-title">Explore open tenders</h2>
          <p className="market-subtitle">{SUBTITLE[source]}</p>
        </div>
        <div className="market-filters" role="group" aria-label="Filter tenders">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className="market-filter"
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="market-empty" role="status">
          {items.length === 0 ? `${source} returned no recent notices. Paste a link above instead.` : "No tenders match this filter yet."}
        </p>
      ) : (
        <ul className="market-grid">
          {shown.map((n) => (
            <li key={n.noticeId}>
              <Link
                href={`/report/${n.noticeId}`}
                className="group tender-card"
              >
                <span className="tender-card-top"><span>{noticeSource(n.noticeId, null).label}</span><span>{n.analysis ? "Report available" : "Open notice"}</span></span>
                <span className="tender-buyer">{n.buyer}</span>
                <span className="tender-title">{isSamNoticeId(n.noticeId) ? n.title : n.title.replace(/^[^–]*–[^–]*–\s*/, "")}</span>
                <span className="tender-deadline">
                  {n.deadline ? <>Tenders due <time dateTime={n.deadline}>{n.deadline.slice(0, 10)}</time></> : "Deadline not provided"}
                </span>
                <span className="tender-card-bottom">
                  {n.analysis ? (
                    <>
                      <span className="tender-signals"><span>{n.analysis.signals.filter((s) => s.fired).length} signals found</span><SignalFingerprint signals={n.analysis.signals} /></span>
                      <span className={`tender-score ${scoreTone(n.analysis.riskScore)}`}>
                        {n.analysis.riskScore}
                        <span className="text-xs font-normal text-mist">/100</span>
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-sm text-mist">Not analyzed yet</span>
                      <span className="tender-analyze">Analyze <span aria-hidden="true">↗</span></span>
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
