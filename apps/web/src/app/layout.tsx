import type { Metadata } from "next";
import { DM_Sans, Manrope } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";
import { Mark } from "@/components/launchcheck/icons";
import { copy } from "@/components/launchcheck/copy";
import { appOrigin } from "@/components/launchcheck/server";
import "./globals.css";
import "@/components/launchcheck/launchcheck.css";
import "@/components/launchcheck/experience.css";
import "@/components/launchcheck/fix-tools.css";
import { experience as text } from "@/components/launchcheck/experience-copy";
const civicSans = DM_Sans({ variable: "--font-civic-sans", subsets: ["latin", "latin-ext"], display: "swap" });
const civicDisplay = Manrope({ variable: "--font-civic-display", subsets: ["latin", "latin-ext"], display: "swap" });
export const metadata: Metadata = { metadataBase: new URL(appOrigin()), title: `${copy.brand} — ${copy.hero}`, description: copy.lede, openGraph: { type: "website", siteName: copy.brand, title: copy.hero, description: copy.lede }, twitter: { card: "summary_large_image", title: copy.hero, description: copy.lede }, icons: { icon: "/icon.svg" } };
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en" className={`${civicSans.variable} ${civicDisplay.variable} h-full overflow-x-clip`}><body className="lc-shell min-h-full flex flex-col overflow-x-clip"><a href="#main-content" className="skip-link">{copy.skip}</a><header className="lc-header"><div className="lc-nav"><Link href="/" className="lc-wordmark" aria-label={copy.brand}><Mark/>{copy.brand}</Link><nav aria-label={copy.home}><Link className="lc-nav-how" href="/#how-it-works">{text.howLink}</Link><Link className="lc-nav-tools" href="/tools/link-preview">{text.toolsLink}</Link><Link href="/gallery">{copy.gallery}</Link><Link className="lc-nav-cta" href="/check">{text.navCheck}</Link></nav></div></header><main id="main-content" className="lc-main">{children}</main><footer className="lc-footer"><div><div><Link className="lc-wordmark" href="/"><Mark/>{copy.brand}</Link><p>{copy.footer}</p><p>{copy.footerScope}</p></div><nav><Link href="/gallery">{copy.gallery}</Link><Link href="/agents">{copy.agents}</Link></nav></div></footer></body></html>;
}
