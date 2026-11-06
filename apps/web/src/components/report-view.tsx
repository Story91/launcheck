"use client";

import type { Report } from "@tendr/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { AuditTable } from "@/components/audit-table";
import { LanguageNote, RiskMeter, StatusBadge } from "@/components/badges";
import { ProgressSteps } from "@/components/progress-steps";
import { SignalCard } from "@/components/signal-card";
import { noticeSource } from "@/lib/source";

type Stored = Report & { progress: string | null };
const FAST_POLL_MS = 2000;
const SLOW_POLL_MS = 30_000;
const GIVE_UP_MS = 4 * 60 * 1000;

export function ReportView({ noticeId, initial }: { noticeId: string; initial: Stored | null }) {
  const [report, setReport] = useState<Stored | null>(initial);
  const [tab, setTab] = useState<"signals" | "audit">("signals");
  const [stalled, setStalled] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const kicked = useRef(false);
  const startedAt = useRef(Date.now());

  const kick = useCallback(async () => {
    kicked.current = true;
    startedAt.current = Date.now();
    setStalled(false);
    setRequestError(null);
    try {
      const res = await fetch("/api/reports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ noticeId }) });
      if (!res.ok) throw new Error("request failed");
      setReport(null);
      return true;
    } catch {
      setRequestError("Could not start the report. Please try again.");
      setStalled(true);
      return false;
    }
  }, [noticeId]);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/reports/${noticeId}`, { cache: "no-store" });
      if (res.status === 404) return;
      if (!res.ok) throw new Error("request failed");
      setReport((await res.json()) as Stored);
      setRequestError(null);
    } catch {
      setRequestError("Could not refresh the report. Check your connection; we will retry automatically.");
    }
  }, [noticeId]);

  // Start generation once when there is no report yet; never re-kick in a loop.
  useEffect(() => {
    if (!initial && !kicked.current) void kick().then((started) => { if (started) return poll(); });
  }, [initial, kick, poll]);

  // Fast polling while generating; slow polling while the independent verification is pending.
  useEffect(() => {
    const generating = !report || report.status === "generating";
    const awaitingVerdict = report?.status === "pending_verification";
    if (!generating && !awaitingVerdict) return;
    const timer = setInterval(() => {
      if (generating && Date.now() - startedAt.current > GIVE_UP_MS) {
        setStalled(true);
        return;
      }
      void poll();
    }, generating ? FAST_POLL_MS : SLOW_POLL_MS);
    return () => clearInterval(timer);
  }, [report, poll]);

  if (!report || report.status === "generating") {
    return (
      <section className="max-w-[70ch]">
        <h1 className="text-3xl">Notice {noticeId}</h1>
        {requestError && <p role="alert" className="mt-3 text-seal">{requestError}</p>}
        <p className="mt-2 text-slate">Building the report. This usually takes 20 to 60 seconds.</p>
        <div className="mt-6">
          <ProgressSteps progress={report?.progress ?? "queued"} />
        </div>
        {stalled && (
          <div className="mt-6 text-sm">
            <p className="text-seal">This is taking longer than expected. The run may have been interrupted.</p>
            <button onClick={() => void kick().then((started) => { if (started) return poll(); })} className="mt-2 bg-ink px-3 py-1.5 text-paper hover:bg-slate">
              Start again
            </button>
          </div>
        )}
      </section>
    );
  }

  if (report.status === "failed") {
    return (
      <section className="max-w-[70ch]">
        <h1 className="text-3xl">Notice {noticeId}</h1>
        <p className="mt-3 text-seal">{report.error ?? "The report could not be generated."}</p>
        {requestError && <p role="alert" className="mt-3 text-seal">{requestError}</p>}
        <p className="mt-2 text-sm text-slate">Check the notice id on sam.gov or the publication number on ted.europa.eu, or try again.</p>
        <button onClick={() => void kick()} className="mt-4 bg-ink px-3 py-1.5 text-sm text-paper hover:bg-slate">
          Retry
        </button>
      </section>
    );
  }

  const source = noticeSource(report.noticeId, report.buyerPlatform);
  const fired = report.signals.filter((s) => s.fired);
  const rest = report.signals.filter((s) => !s.fired);
  const value = report.facts?.estimatedValue ? Number(report.facts.estimatedValue.replace(/[^\d.]/g, "")) : NaN;

  return (
    <div className="space-y-10">
      <section>
        <p className="text-sm text-slate">
          {report.facts?.buyer} · <a href={source.url} target="_blank" rel="noreferrer" className="text-tide underline-offset-2 hover:underline">{source.label} notice</a>
          {Number.isFinite(value) && ` · ${value.toLocaleString("en-GB")} ${report.facts?.currency ?? ""}`}
          {report.facts?.deadlineForTenders && ` · tenders due ${report.facts.deadlineForTenders.slice(0, 10)}`}
        </p>
        <h1 className="mt-1 max-w-[30ch] text-3xl leading-tight">{report.facts?.title ?? `Notice ${noticeId}`}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
          <StatusBadge status={report.status} />
          {report.reppo?.sandbox && <span className="text-sm text-amber">Sandbox verdict (not an independent review)</span>}
          {report.partial && <span className="text-sm text-amber">Partial: some signals could not be evaluated</span>}
          <LanguageNote noticeId={report.noticeId} language={report.noticeLanguage} />
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
