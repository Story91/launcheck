"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Report } from "./contract";
import { readReport } from "./api";
import { copy, fixedHeadline } from "./copy";
import { timestamp } from "./format";

export function Changes({ report }: { report: Report }) {
  const [previous, setPrevious] = useState<Report | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const parentId = report.diff?.parentId;
  useEffect(() => {
    setPrevious(null); setUnavailable(false);
    if (!parentId) return;
    const controller = new AbortController();
    readReport(parentId, AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]))
      .then(parent => { if (controller.signal.aborted) return; if (parent.id !== parentId || parent.origin !== report.origin) throw new Error("Parent mismatch"); setPrevious(parent); })
      .catch(() => { if (!controller.signal.aborted) setUnavailable(true); });
    return () => controller.abort();
  }, [parentId, report.origin]);
  if (!report.diff) return null;
  const diff = report.diff;
  const groups = [
    { name: copy.fixed, ids: diff.fixed, kind: "fixed" },
    { name: copy.remainingFindings, ids: diff.stillThere, kind: "remaining" },
    { name: copy.newFindings, ids: diff.new, kind: "new" },
  ];
  return <section className="lc-changes" aria-labelledby="changes-title">
    <h2 id="changes-title">{fixedHeadline(diff.fixed.length, diff.fixed.length + diff.stillThere.length)}</h2>
    <p className="lc-small lc-muted">{copy.comparisonScope}</p>
    <div className="lc-change-dates"><span>{copy.before}: {timestamp(diff.parentCheckedAt)}</span><span>{copy.after}: {timestamp(report.finishedAt ?? report.createdAt)}</span></div>
    {unavailable && <p role="status">{copy.previousUnavailable}</p>}
    {!previous && !unavailable && <p role="status">{copy.loadingPrevious}</p>}
    <div className="lc-change-groups">{groups.map(group => <details key={group.kind} open={group.ids.length > 0}>
      <summary><span>{group.name}</span><strong>{group.ids.length}</strong></summary>
      {group.ids.length ? <ul>{group.ids.map(id => {
        const finding = group.kind === "fixed" ? previous?.findings.find(f => f.id === id) : report.findings.find(f => f.id === id) ?? previous?.findings.find(f => f.id === id);
        return <li key={id}><strong>{finding?.title ?? id}</strong>{finding && <p>{finding.observed}</p>}{!finding && <p className="lc-muted">{copy.changeEvidenceMissing}</p>}</li>;
      })}</ul> : <p className="lc-muted">{copy.noChangesInGroup}</p>}
    </details>)}</div>
    <Link href={`/check/${encodeURIComponent(diff.parentId)}`}>{copy.previous}</Link>
  </section>;
}
