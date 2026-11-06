import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { copy } from "@/components/launchcheck/copy";
import { getDemoFixed } from "@/lib/launchcheck/demo";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> { const demoFixed = await getDemoFixed(); return { title: demoFixed ? copy.demoFixedTitle : copy.demoBrokenTitle, description: copy.demoText, openGraph: demoFixed ? { title: copy.demoTitle, images: ["/api/demo/acme-card"] } : null, twitter: demoFixed ? { card: "summary_large_image", title: copy.demoTitle, images: ["/api/demo/acme-card"] } : null, robots: { index: false, follow: false } }; }
export async function generateViewport(): Promise<Viewport> { return await getDemoFixed() ? { width: "device-width", initialScale: 1 } : { width: undefined, initialScale: undefined }; }
export default async function DemoPage() { const demoFixed = await getDemoFixed(); return <><p className="lc-demo-notice">{demoFixed ? copy.demoFixedNotice : copy.demoNotice}</p><section className={`lc-acme ${demoFixed ? "" : "lc-acme-broken"}`}><nav><strong>{copy.demoTitle}</strong><Link href={demoFixed ? "#pricing" : "/demo/acme-launch/pricing"}>{copy.demoPricing}</Link></nav><h1>{copy.demoHeading}</h1><p>{copy.demoText}</p><a href="#plan" className="lc-button">{copy.demoAction}</a><section id="plan" className="lc-section"><h2>{copy.demoLearn}</h2><p>{copy.demoText}</p></section>{demoFixed && <section id="pricing"><h2>{copy.demoPricing}</h2><p>{copy.fixture}</p></section>}</section></>; }
