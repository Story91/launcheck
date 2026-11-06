import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { copy } from "@/components/launchcheck/copy";
// Replace with Claude's getDemoFixed() when the backend toggle is delivered.
const demoFixed = false;
export const metadata: Metadata = { title: demoFixed ? copy.demoFixedTitle : copy.demoBrokenTitle, description: copy.demoText, openGraph: demoFixed ? { title: copy.demoTitle, images: ["/images/launchcheck-demo-desktop.png"] } : null, twitter: demoFixed ? { card: "summary_large_image" } : null, robots: { index: false, follow: false } };
export const viewport: Viewport = demoFixed ? { width: "device-width", initialScale: 1 } : { width: undefined, initialScale: undefined };
export default function DemoPage() { return <><p className="lc-demo-notice">{copy.demoNotice}</p><section className={`lc-acme ${demoFixed ? "" : "lc-acme-broken"}`}><nav><strong>{copy.demoTitle}</strong><Link href={demoFixed ? "#pricing" : "/demo/acme-launch/pricing"}>{copy.demoPricing}</Link></nav><h1>{copy.demoHeading}</h1><p>{copy.demoText}</p><a href="#plan" className="lc-button">{copy.demoAction}</a><section id="plan" className="lc-section"><h2>{copy.demoLearn}</h2><p>{copy.demoText}</p></section>{demoFixed && <section id="pricing"><h2>{copy.demoPricing}</h2><p>{copy.fixture}</p></section>}</section></>; }
