import { defaultSearchQuery, isSamNoticeId, searchNotices, searchSamOpportunities, type NoticeSummary, type Report } from "@tendr/core";
import Link from "next/link";
import { NoticeForm } from "@/components/notice-form";
import { type MarketItem, TenderMarket } from "@/components/tender-market";
import { IT_NAICS_PREFIXES, samNoticeStore } from "@/lib/sam-notices";
import { reportStore } from "@/lib/store";
import { STATUS_COPY } from "@/components/badges";
import { isReady, strongestQuote, verdictTone, verdictWord } from "@/lib/verdict";

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
    <div className="space-y-16">
      <section className="grid grid-cols-1 overflow-hidden rounded-3xl border border-rule md:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-6 bg-white p-6 sm:p-12">
          <h1 className="font-sans! text-[2.5rem] leading-[1.05] break-words font-bold tracking-tight sm:text-5xl">Is this tender written for someone else?</h1>
          <p className="text-lg text-slate">One question. One link. A sourced answer in about 40 seconds.</p>
          <NoticeForm />
          {tryNotices.length > 0 && (
            <div className="flex min-w-0 flex-col gap-2 text-sm">
              {tryNotices.map((n) => (
                <Link key={n.noticeId} href={`/report/${n.noticeId}`} title={n.title} className="max-w-full truncate rounded-full bg-paper-deep px-3 py-1.5 text-slate hover:text-ink">
                  Try: {n.title}
                </Link>
              ))}
            </div>
          )}
          <p className="mt-auto text-xs text-mist">Reasoning by SERV · reviewed by Reppo · pay-per-report via x402</p>
        </div>
        <div className={`flex min-w-0 flex-col justify-center gap-4 p-6 text-white sm:p-12 ${featured ? verdictTone(featured.riskScore) : "bg-seal"}`}>
          {featured ? (
            <>
              <p className="text-sm opacity-80">
                Answer · {featured.facts?.buyer ?? featured.noticeId}
                {featured.facts?.title && <span className="block truncate opacity-90" title={featured.facts.title}>{featured.facts.title}</span>}
              </p>
              <p className="font-sans text-7xl font-extrabold leading-none tracking-tight sm:text-8xl">{verdictWord(featured.riskScore)}</p>
              <p className="text-lg opacity-90">
                {firedCount} of {featured.signals.length} signals · {highCount} high · score {featured.riskScore}/100
              </p>
              {quote && (
                <Link href={`/report/${featured.noticeId}`} className="rounded-xl bg-white/12 p-4 leading-relaxed hover:bg-white/20">
                  <span lang={quoteLang}>“{quote.text}”</span>
                  <span className="opacity-70"> — {SIGNAL_NAMES[quote.signalId] ?? quote.signalId}, verbatim ✓</span>
                </Link>
              )}
              <p className="text-sm opacity-80">
                {STATUS_COPY[featured.status].label} ·{" "}
                <Link href={`/report/${featured.noticeId}`} className="underline underline-offset-2">
                  open the full report
                </Link>
              </p>
            </>
          ) : (
            <>
              <p className="text-sm opacity-80">The answer comes as one word</p>
              <p className="font-sans text-7xl font-extrabold leading-none tracking-tight sm:text-8xl">Likely.</p>
              <p className="text-lg opacity-90">Possibly. · Unlikely. — backed by eight signals and every quote the verdict relies on, verbatim.</p>
            </>
          )}
        </div>
      </section>
      <TenderMarket items={items} source={source} />
    </div>
  );
}
