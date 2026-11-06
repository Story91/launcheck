"use client";
import { useState } from "react";
import type { Report } from "./contract";
import { copy } from "./copy";
import { EvidenceRecord } from "./evidence";
import { checkSpend } from "./format";

type Filter = "all" | "problem" | "clear" | "not_checked" | "active";
const matches = (state: string, filter: Filter) => filter === "all" || (filter === "active" ? state === "pending" || state === "running" : state === filter);
export function Checklist({ report }: { report: Report }) {
  const [filter, setFilter] = useState<Filter>("all");
  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: copy.allChecks }, { id: "problem", label: copy.checkStates.problem },
    { id: "not_checked", label: copy.checkStates.not_checked }, { id: "clear", label: copy.checkStates.clear },
    { id: "active", label: copy.inProgress },
  ];
  const checks = report.checks.filter(check => matches(check.state, filter));
  return <section id="checks" className="lc-report-section">
    <div className="lc-section-heading"><h2>{copy.checklist}</h2></div>
    <p className="lc-small lc-muted">{copy.openRow}</p>
    <div className="lc-check-filters" role="group" aria-label={copy.filterChecks}>{filters.map(item => {
      const count = report.checks.filter(check => matches(check.state, item.id)).length;
      return <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}<span>{count}</span></button>;
    })}</div>
    <div className="lc-tests" aria-live="polite">{checks.map(check => <details className="lc-test" id={`test-${check.checkId}`} key={check.checkId}>
      <summary><span className="lc-test-name">{check.label}<small>{check.kind === "free" ? copy.byLaunchCheck : copy.paid}</small></span><span className={`lc-status lc-status-${check.state}`}><span aria-hidden="true">{check.state === "problem" ? "!" : check.state === "clear" ? "✓" : check.state === "running" ? "◌" : "—"}</span>{copy.checkStates[check.state]}</span></summary>
      <div className="lc-test-body">{check.notCheckedReason && <p className="lc-unknown">{copy.reasons[check.notCheckedReason]}</p>}<p>{copy.scope}: {check.scopeNote ?? copy.notRecorded}</p>{check.evidenceIds.map(id => {
        const item = report.evidence.find(e => e.id === id);
        return item ? <EvidenceRecord key={id} item={item} paidUsd={checkSpend(report, item.checkId)}/> : <p key={id}>{copy.noEvidence}</p>;
      })}{!check.evidenceIds.length && <p>{copy.noEvidence}</p>}</div>
    </details>)}</div>
    {!checks.length && <p role="status" className="lc-small lc-muted">{copy.noChecksInFilter}</p>}
  </section>;
}
