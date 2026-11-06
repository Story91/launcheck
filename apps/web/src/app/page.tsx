import Link from "next/link";
import { featuredReport } from "@/lib/launchcheck/featured";
import { imageSource, originalFindingCount, usd } from "@/components/launchcheck/format";
import { CheckForm } from "@/components/launchcheck/check-form";
import { copy, fixedHeadline } from "@/components/launchcheck/copy";
import { experience as text } from "@/components/launchcheck/experience-copy";
import { LaunchScene } from "@/components/launchcheck/launch-scene";

export default async function Home({ searchParams }: { searchParams: Promise<{ fixture?: string }> }) {
  const fixture = (await searchParams).fixture === "1";
  const real = fixture ? null : await featuredReport();
  const receiptUrl = real ? `/check/${encodeURIComponent(real.id)}` : "/check/fx_problems";
  const preview = real ? imageSource(real.evidence.find(e => e.kind === "image" && e.checkId === "render_desktop")?.blobUrl) : undefined;
  return <div className="lc-home lc-home-new">
    <section className="lc-launch-hero">
      <div className="lc-launch-intro"><p className="lc-launch-invitation"><span aria-hidden="true">✳</span>{text.heroTop}</p><h1>{text.heroFirst}<br/>{text.heroSecond}</h1><p className="lc-launch-lede">{copy.lede}</p><div className="lc-launch-actions"><a className="lc-button" href="#start">{text.heroCta}<span aria-hidden="true">↗</span></a><Link className="lc-watch-link" href={receiptUrl}><span aria-hidden="true">▷</span>{real ? text.heroSecondary : text.heroExample}</Link></div><p className="lc-launch-note">{text.heroNote}</p></div>
      <LaunchScene/>
    </section>
    <section className="lc-launch-desk" id="how-it-works">
      <ol className="lc-desk-steps">{copy.how.map((step, i) => <li key={step.title}><span aria-hidden="true">{i + 1}</span><strong>{step.title}</strong></li>)}</ol>
      <div className="lc-start-panel" id="start"><div className="lc-start-heading"><h2>{text.startTitle}</h2><p>{text.startText}</p></div><CheckForm fixture={fixture} proof={real ? <div className="lc-desk-proof"><div className="lc-desk-proof-heading"><span>{text.proofLabel}</span><span>{copy.liveObservation}</span></div>{preview && <Link href={receiptUrl} className="lc-desk-proof-image"><img src={preview} alt={copy.captureTitle} width="1280" height="800" loading="lazy"/></Link>}<h3>{real.diff ? fixedHeadline(real.diff.fixed.length, originalFindingCount(real.diff)) : text.proofTitle}</h3><p>{real.summary.checksRun} {copy.checks} · {usd(real.spentUsd)} {copy.confirmedSpend.toLowerCase()}</p><Link href={receiptUrl}>{real.diff ? text.proofCta : text.heroSecondary}<span aria-hidden="true">↗</span></Link><small>{text.proofFootnote}</small></div> : undefined}/></div>
      <div className="lc-desk-powered"><span>{text.servName}<small>{text.servText}</small></span><span>{text.kiteName}<small>{text.kiteText}</small></span><Link href="/gallery">{copy.viewGallery}<span aria-hidden="true">↗</span></Link></div>
    </section>
    <section className="lc-toolbox"><div className="lc-section-heading"><h2>{text.toolboxTitle}</h2><p>{text.toolboxText}</p></div><div className="lc-tool-grid"><article className="lc-tool-pack"><div className="lc-pack-art" aria-hidden="true"><span>↳</span><i/><i/><i/><b>⌘ C</b></div><h3>{text.packTitle}</h3><p>{text.packText}</p><Link className="lc-button lc-button-quiet" href={`${receiptUrl}#fix-workspace`}>{text.packAction}</Link></article><article className="lc-tool-preview"><div className="lc-preview-art" aria-hidden="true"><span>↗</span><div><i/><i/></div></div><h3>{text.previewTitle}</h3><p>{text.previewText}</p><Link className="lc-button lc-button-quiet" href="/tools/link-preview">{text.previewAction}</Link><span className="lc-small">{text.previewFree}</span></article></div></section>
    <section className="lc-faq"><h2>{text.faqTitle}</h2><div>{text.faqs.map(item => <details key={item.q}><summary>{item.q}<span aria-hidden="true">+</span></summary><p>{item.a}</p></details>)}</div></section>
  </div>;
}
