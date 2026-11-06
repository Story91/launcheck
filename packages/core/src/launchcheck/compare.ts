import type { LaunchCheckFinding, LaunchCheckReport } from "./types";
const key = (f: LaunchCheckFinding) => `${f.checkId}|${f.ruleId}|${(f.observed.match(/https?:\/\/[^\s<>"']+/g) ?? []).map(url => url.replace(/[).,;]+$/, "")).sort().join("|")}`;
/** Absence only establishes a fix when the same check actually ran with inspectable evidence. */
export function compareReports(previous: LaunchCheckReport, current: LaunchCheckReport): LaunchCheckReport["diff"] {
  if (previous.status !== "done" || current.status !== "done" || previous.url !== current.url) return null;
  const fixed: string[] = [], stillThere: string[] = [], unresolved: string[] = [];
  const currentKeys = new Set(current.findings.map(key)), previousKeys = new Set(previous.findings.map(key));
  for (const finding of previous.findings) {
    if (currentKeys.has(key(finding))) { stillThere.push(finding.id); continue; }
    const check = current.checks.find(c => c.checkId === finding.checkId);
    const observed = check && (check.state === "clear" || check.state === "problem") && check.evidenceIds.some(id => current.evidence.some(e => e.id === id));
    (observed ? fixed : unresolved).push(finding.id);
  }
  return { parentId: previous.id, parentCheckedAt: previous.finishedAt ?? previous.createdAt, fixed, stillThere, unresolved, new: current.findings.filter(f => !previousKeys.has(key(f))).map(f => f.id) };
}
