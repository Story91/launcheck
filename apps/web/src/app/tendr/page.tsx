import { defaultSearchQuery, isSamNoticeId, searchNotices, searchSamOpportunities, type NoticeSummary, type Report } from "@tendr/core";
import Link from "next/link";
import { NoticeForm } from "@/components/notice-form";
import { type MarketItem, TenderMarket } from "@/components/tender-market";
import { IT_NAICS_PREFIXES, samNoticeStore } from "@/lib/sam-notices";
import { reportStore } from "@/lib/store";
import { STATUS_COPY } from "@/components/badges";
import { isReady, strongestQuote } from "@/lib/verdict";

// The SAM.gov extract is imported once a day; an hourly refresh is plenty.
export const revalidate = 3600;

async function loadNotices(): Promise<{ source: "SAM.gov" | "TED"; notices: NoticeSummary[] }> {
  try {
    const imported = await samNoticeStore().listOpen({ naicsPrefixes: IT_NAICS_PREFIXES, limit: 15, now: new Date() });
    if (imported.length > 0) return { source: "SAM.gov", notices: imported };
  } catch {
    /* table missing or database unreachable: try the API, then TED */
  }
  const apiKey = process.env.SAM_API_KEY;
  if (apiKey) {
    try {
      const notices = await searchSamOpportunities({ apiKey, limit: 5 });
      if (notices.length > 0) return { source: "SAM.gov", notices: notices.slice(0, 15) };
    } catch {
      /* fall back to TED below */
    }
  }
  try {
    return { source: "TED", notices: await searchNotices(defaultSearchQuery(), { limit: 12 }) };
  } catch {
    return { source: "TED", notices: [] };
  }
}

const SIGNAL_NAMES: Record<string, string> = {
  S1_SHORT_DEADLINE: "short deadline",
  S2_BRAND_LOCK: "brand lock",
  S3_OVER_SPECIFICATION: "over-specification",
  S4_EXPERIENCE_LOCK: "experience lock",
  S5_PRICE_WEIGHT_LOW: "low price weight",
  S6_DISPROPORTIONATE_CONDITIONS: "disproportionate conditions",
  S7_NO_LOTS_LARGE_SCOPE: "no lots",
  S8_UNUSUAL_NOTES: "unusual requirements",
};

export default async function HomePage() {
  const { source, notices } = await loadNotices();
  let reports: Report[] = [];
  try {
    reports = (await reportStore().listRecent(200)).filter(isReady);
  } catch {
    reports = [];
  }
  const byId = new Map(reports.map((r) => [r.noticeId, r]));
  const items: MarketItem[] = notices.map((n) => {
    const r = byId.get(n.noticeId);
    return { ...n, analysis: r ? { riskScore: r.riskScore, signals: r.signals } : null };
  });
  // The hero answer is a real report from the same source as the list below (US reports next to SAM.gov notices),
  // preferring reports that cite a quote, then the highest score.
  const sameSource = reports.filter((r) => isSamNoticeId(r.noticeId) === (source === "SAM.gov"));
  const featured =
    [...sameSource].sort((a, b) => Number(!!strongestQuote(b)) - Number(!!strongestQuote(a)) || b.riskScore - a.riskScore)[0] ?? null;
  const quote = featured ? strongestQuote(featured) : null;
  const firedCount = featured?.signals.filter((s) => s.fired).length ?? 0;
  const highCount = featured?.signals.filter((s) => s.fired && s.severity === "high").length ?? 0;
  const quoteLang = featured && !isSamNoticeId(featured.noticeId) ? (featured.noticeLanguage === "POL" ? "pl" : undefined) : "en";
  // "Try" chips: open notices from the list that have no report yet, by title.
  const tryNotices = items.filter((i) => !i.analysis).slice(0, 2);

  return (
    <div className="civic-home">
      <section className="civic-hero" aria-labelledby="hero-title">
        <div className="civic-intro">
          <h1 id="hero-title">A clearer view of public tenders.</h1>
          <p className="civic-description">Find competition signals in the fine print. Follow every finding back to its source.</p>
          <NoticeForm />
          <p className="civic-hint">Free in your browser. No account needed. Usually 20–60 seconds.</p>
          {tryNotices.length > 0 && (
            <div className="civic-examples">
              {tryNotices.map((n) => (
                <Link key={n.noticeId} href={`/report/${n.noticeId}`} title={n.title}>
                  Try: {n.title}
                </Link>
              ))}
            </div>
          )}
          <p className="civic-partners">Reasoning by SERV <span aria-hidden="true">/</span> Independent review by Reppo</p>
        </div>
        <div className="civic-evidence">
          {featured ? (
            <>
              <p className="civic-evidence-label">Inside a real report <span>{source}</span></p>
              <p className="civic-buyer">
                {featured.facts?.buyer ?? featured.noticeId}
                {featured.facts?.title && <span title={featured.facts.title}>{featured.facts.title}</span>}
              </p>
              <h2>{firedCount === 0 ? "No signals detected." : `${firedCount} ${firedCount === 1 ? "signal" : "signals"} to look closer at.`}</h2>
              <p className="civic-signal-detail">{featured.signals.length} signals checked · {highCount} high severity · score {featured.riskScore}/100</p>
              {quote && (
                <Link href={`/report/${featured.noticeId}`} className="civic-quote">
                  <span lang={quoteLang}>“{quote.text}”</span>
                  <span className="civic-quote-source">{SIGNAL_NAMES[quote.signalId] ?? quote.signalId} · Exact quote from the notice</span>
                </Link>
              )}
              <p className="civic-evidence-footer">
                <span>{STATUS_COPY[featured.status].label}</span>
                <Link href={`/report/${featured.noticeId}`}>
                  Read report <span aria-hidden="true">↗</span>
                </Link>
              </p>
            </>
          ) : (
            <>
              <p className="civic-evidence-label">Inside every report</p>
              <h2>Evidence you can read.<br />Reasoning you can check.</h2>
              <p className="civic-signal-detail">Eight competition signals, exact quotes from the notice and a separate independent review.</p>
              <div className="civic-quote">Start with a link or choose a tender below.<span className="civic-quote-source">Signals are not findings of wrongdoing.</span></div>
            </>
          )}
        </div>
      </section>
      <TenderMarket items={items} source={source} />
    </div>
  );
}
