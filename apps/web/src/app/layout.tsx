import type { Metadata } from "next";
import { DM_Sans, Manrope } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";
import "./globals.css";

const civicSans = DM_Sans({ variable: "--font-civic-sans", subsets: ["latin", "latin-ext"], display: "swap" });
const civicDisplay = Manrope({ variable: "--font-civic-display", subsets: ["latin", "latin-ext"], display: "swap" });

export const metadata: Metadata = {
  title: "Tendr — competition-restriction signals for public tenders",
  description: "Auditable competition-restriction signal reports for US federal (SAM.gov) and EU (TED) tenders, with verbatim quotes and independent verification.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${civicSans.variable} ${civicDisplay.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <a href="#main-content" className="skip-link">Skip to content</a>
        <header className="site-header">
          <div className="site-nav">
            <Link href="/" className="site-brand" aria-label="Tendr home">
              <span className="brand-mark" aria-hidden="true" />tendr
            </Link>
            <nav className="site-links" aria-label="Main navigation">
              <Link href="/">Explore tenders</Link>
              <Link href="/api-docs">For agents <span aria-hidden="true">↗</span></Link>
            </nav>
          </div>
        </header>
        <main id="main-content" className="site-main">{children}</main>
        <footer className="border-t border-rule">
          <p className="mx-auto max-w-6xl px-5 py-6 text-xs leading-relaxed text-mist">
            Reports describe competition-restriction signals found in the notice text. They are not findings of wrongdoing. Sources: SAM.gov public data (US federal) and TED (EU). Not affiliated with GSA, SAM.gov or any government agency. Reasoning by SERV, independent review by Reppo.
          </p>
        </footer>
      </body>
    </html>
  );
}
