import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Serif } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";
import "./globals.css";

const plexSans = IBM_Plex_Sans({ variable: "--font-plex-sans", subsets: ["latin", "latin-ext"], weight: ["400", "500", "600"] });
const plexSerif = IBM_Plex_Serif({ variable: "--font-plex-serif", subsets: ["latin", "latin-ext"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "Tendr — competition-restriction signals for public tenders",
  description: "Auditable competition-restriction signal reports for US federal (SAM.gov) and EU (TED) tenders, with verbatim quotes and independent verification.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexSerif.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <header className="border-b border-rule">
          <div className="mx-auto flex w-full max-w-5xl items-baseline justify-between gap-6 px-4 py-4">
            <Link href="/" className="font-serif text-xl text-ink">
              Tendr
            </Link>
            <nav className="flex gap-5 text-sm text-slate">
              <Link href="/">Notices</Link>
              <Link href="/api-docs">Buy reports via API</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-rule">
          <p className="mx-auto max-w-5xl px-4 py-5 text-xs text-mist">
            Reports describe competition-restriction signals found in the notice text. They are not findings of wrongdoing. Sources: SAM.gov public data (US federal) and TED (EU). Not affiliated with GSA, SAM.gov or any government agency. Reasoning by SERV, independent review by Reppo.
          </p>
        </footer>
      </body>
    </html>
  );
}
