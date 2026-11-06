import type { Report } from "./contract";
import { copy } from "./copy";
import { timestamp, safeWebUrl, isFixture } from "./format";

// A JSON data block keeps page/provider text distinct from the brief's instructions.
export function fixBrief(report: Report, reportUrl: string) {
  const data = {
    illustrative: isFixture(report.id),
    reportUrl: safeWebUrl(reportUrl),
    pageUrl: report.url,
    observedAt: timestamp(report.finishedAt ?? report.createdAt),
    status: report.status,
    findings: report.findings.map(finding => ({
      ruleId: finding.ruleId,
      severity: finding.severity,
      title: finding.title,
      observed: finding.observed,
      suggestedFix: finding.fix,
      evidence: finding.evidenceIds.map(id => {
        const evidence = report.evidence.find(item => item.id === id);
        return evidence ? {
          id, source: evidence.source, capturedAt: evidence.capturedAt,
          sha256: evidence.sha256, scope: evidence.scopeNote, fields: evidence.fields,
        } : { id, unavailable: true };
      }),
    })),
    notChecked: report.notChecked,
  };
  return `${copy.fixBriefIntro}\n\n${copy.fixBriefBoundary}\n\n${JSON.stringify(data, null, 2)}`;
}
