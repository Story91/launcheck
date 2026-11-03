"use client";

import type { Report } from "@tenderhound/core";
import { useEffect, useState } from "react";
import { AuditTable } from "@/components/audit-table";
import { LanguageNote, RiskMeter, StatusBadge } from "@/components/badges";
import { ProgressSteps } from "@/components/progress-steps";
import { SignalCard } from "@/components/signal-card";

type Stored = Report & { progress: string | null };
const POLL_MS = 2000;
const GIVE_UP_MS = 4 * 60 * 1000;

export function ReportView({ noticeId, initial }: { noticeId: string; initial: Stored | null }) {
  const [report, setReport] = useState<Stored | null>(initial);
  const [tab, setTab] = useState<"signals" | "audit">("signals");
  const [stalled, setStalled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const started = Date.now();

    async function kick() {
      await fetch("/api/reports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ noticeId }) });
    }
    async function poll() {
      const res = await fetch(`/api/reports/${noticeId}`, { cache: "no-store" });
      if (res.status === 404) {
        await kick();
        return;
      }
      const next = (await res.json()) as Stored;
      if (!cancelled) setReport(next);
    }

    const needsPolling = () => !report || report.status === "generating";
    if (!report) void kick().then(poll);
    const timer = setInterval(() => {
      if (!needsPolling()) return;
      if (Date.now() - started > GIVE_UP_MS) {
        setStalled(true);
        return;
      }
      void poll();
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noticeId, report?.status]);

  if (!report || report.status === "generating") {
    return (
      <section className="max-w-[70ch]">
        <h1 className="text-3xl">Notice {noticeId}</h1>
        <p className="mt-2 text-slate">Building the report. This usually takes 20 to 60 seconds.</p>
        <div className="mt-6">
          <ProgressSteps progress={report?.progress ?? "queued"} />
        </div>
        {stalled && (
          <p className="mt-6 text-sm text-seal">
            This is taking longer than expected. Reload the page; if it still does not finish, the notice may be unusually large.
          </p>
        )}
      </section>
    );
  }

  if (report.status === "failed") {
    return (
      <section className="max-w-[70ch]">
        <h1 className="text-3xl">Notice {noticeId}</h1>
        <p className="mt-3 text-seal">{report.error ?? "The report could not be generated."}</p>
        <p className="mt-2 text-sm text-slate">Check the publication number on ted.europa.eu and try again.</p>
      </section>
    );
  }

  const fired = report.signals.filter((s) => s.fired);
  const rest = report.signals.filter((s) => !s.fired);

  return (
    <div className="space-y-10">
      <section>
        <p className="text-sm text-slate">
          {report.facts?.buyer} · TED {report.noticeId}
          {report.facts?.estimatedValue && ` · ${Number(report.facts.estimatedValue).toLocaleString("en-GB")} ${report.facts.currency ?? ""}`}
          {report.facts?.deadlineForTenders && ` · tenders due ${report.facts.deadlineForTenders.slice(0, 10)}`}
        </p>
        <h1 className="mt-1 max-w-[30ch] text-3xl leading-tight">{report.facts?.title ?? `Notice ${noticeId}`}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
          <StatusBadge status={report.status} />
          <LanguageNote language={report.noticeLanguage} />
        </div>
      </section>

      {report.status === "withheld" ? (
        <section className="max-w-[70ch] border border-seal/40 p-4">
          <p className="text-slate">Independent reviewers rejected this report, so its signals are not shown.</p>
          {report.reppo?.critique && <p className="mt-2 text-sm text-slate">Critique: {report.reppo.critique}</p>}
        </section>
      ) : (
        <>
          <section className="max-w-3xl">
            <RiskMeter score={report.riskScore} />
            {report.summary && <p className="mt-5 max-w-[70ch] text-lg leading-relaxed text-ink">{report.summary}</p>}
            {report.reppo && report.reppo.status === "SETTLED" && (
              <p className="mt-3 text-sm text-slate">
                Independent review: score {report.reppo.score ?? "—"}/100, decision {report.reppo.decision}, confidence {report.reppo.confidence ?? "—"}
                {report.reppo.critique && ` — ${report.reppo.critique}`}
              </p>
            )}
          </section>

          <section>
            <div className="flex gap-6 border-b border-rule text-sm" role="tablist">
              {(["signals", "audit"] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={`-mb-px border-b-2 pb-2 ${tab === t ? "border-ink text-ink" : "border-transparent text-mist hover:text-slate"}`}
                >
                  {t === "signals" ? `Signals (${fired.length} of ${report.signals.length} detected)` : "Audit trail"}
                </button>
              ))}
            </div>
            {tab === "signals" ? (
              <div className="mt-2">
                {fired.map((s) => (
                  <SignalCard key={s.id} signal={s} />
                ))}
                {rest.map((s) => (
                  <SignalCard key={s.id} signal={s} />
                ))}
              </div>
            ) : (
              <div className="mt-4">
                <AuditTable audit={report.audit} costUsd={report.costUsd} droppedEvidence={report.droppedEvidence} />
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
