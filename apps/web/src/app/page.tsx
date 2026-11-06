import Link from "next/link";
import { featuredReport } from "@/lib/launchcheck/featured";
import { imageSource, originalFindingCount, usd, websiteLabel } from "@/components/launchcheck/format";
import { CheckForm } from "@/components/launchcheck/check-form";
import { Gallery } from "@/components/launchcheck/gallery";
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
    <div className="lc-powered"><span>{text.techIntro}</span><div><strong>{text.servName}</strong><p>{text.servText}</p></div><span className="lc-powered-plus" aria-hidden="true">+</span><div><strong>{text.kiteName}</strong><p>{text.kiteText}</p></div></div>
    <section className="lc-journey" id="how-it-works"><div className="lc-section-heading"><h2>{copy.howTitle}</h2><p>{copy.promise}</p></div><div className="lc-journey-steps">{copy.how.map((step, i) => <article key={step.title}><span className="lc-step-number" aria-hidden="true">{i + 1}</span><h3>{step.title}</h3><p>{step.text}</p></article>)}</div></section>
    <section className="lc-start-panel" id="start"><div className="lc-start-heading"><h2>{text.startTitle}</h2><p>{text.startText}</p></div><CheckForm fixture={fixture}/></section>
    <section className="lc-toolbox"><div className="lc-section-heading"><h2>{text.toolboxTitle}</h2><p>{text.toolboxText}</p></div><div className="lc-tool-grid"><article className="lc-tool-pack"><div className="lc-pack-art" aria-hidden="true"><span>↳</span><i/><i/><i/><b>⌘ C</b></div><h3>{text.packTitle}</h3><p>{text.packText}</p><Link className="lc-button lc-button-quiet" href={`${receiptUrl}#fix-workspace`}>{text.packAction}</Link></article><article className="lc-tool-preview"><div className="lc-preview-art" aria-hidden="true"><span>↗</span><div><i/><i/></div></div><h3>{text.previewTitle}</h3><p>{text.previewText}</p><Link className="lc-button lc-button-quiet" href="/tools/link-preview">{text.previewAction}</Link><span className="lc-small">{text.previewFree}</span></article></div></section>
    {real && <section className="lc-proof-banner"><div><p>{text.proofLabel}</p><h2>{real.diff ? fixedHeadline(real.diff.fixed.length, originalFindingCount(real.diff)) : text.proofTitle}</h2><p>{websiteLabel(real.origin)} · {real.summary.checksRun} {copy.checks} · {usd(real.spentUsd)} {copy.confirmedSpend.toLowerCase()}</p><Link href={receiptUrl} className="lc-text-link">{real.diff ? text.proofCta : text.heroSecondary}</Link><small>{text.proofFootnote}</small></div>{preview && <Link href={receiptUrl} tabIndex={-1} aria-hidden="true"><img src={preview} alt="" width="1280" height="800" loading="lazy"/></Link>}</section>}
    <section className="lc-section"><div className="lc-section-heading"><h2>{fixture ? copy.examples : text.proofTitle}</h2><Link className="lc-text-link" href="/gallery">{copy.viewGallery}</Link></div><Gallery fixture={fixture} limit={3}/></section>
    <section className="lc-faq"><h2>{text.faqTitle}</h2><div>{text.faqs.map(item => <details key={item.q}><summary>{item.q}<span aria-hidden="true">+</span></summary><p>{item.a}</p></details>)}</div></section>
    <section className="lc-boundary"><h2>{copy.boundaryTitle}</h2><p>{copy.boundaryBody}</p></section>
  </div>;
}
