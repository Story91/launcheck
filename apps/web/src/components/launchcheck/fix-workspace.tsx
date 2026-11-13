"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Report } from "./contract";
import { copy } from "./copy";
import { experience as text } from "./experience-copy";
import { fixBrief } from "./fix-brief";
import { saveFile } from "./downloads";
import { isFixture } from "./format";
import { launchCheckFixArea } from "@tendr/core/launchcheck/fix-area";

export function FixWorkspace({ report }: { report: Report }) {
  const [selected, setSelected] = useState(() => new Set(report.findings.filter(f => f.severity !== "fyi").map(f => f.id)));
  const [message, setMessage] = useState("");
  const [manual, setManual] = useState(false);
  const preview = useRef<HTMLDetailsElement>(null);
  const chosen = useMemo(() => report.findings.filter(f => selected.has(f.id)), [report.findings, selected]);
  const reportUrl = () => `${window.location.origin}/check/${encodeURIComponent(report.id)}`;
  function pack() { return fixBrief({ ...report, findings: chosen }, reportUrl()); }
  function select(id: string) { setSelected(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; }); setMessage(""); setManual(false); }
  async function copyPack() {
    if (!chosen.length) return;
    try { await navigator.clipboard.writeText(pack()); setMessage(text.fixes.copied); }
    catch { setManual(true); setMessage(text.fixes.manual); if (preview.current) preview.current.open = true; }
  }
  return <section className="lc-fix-workspace" id="fix-workspace" aria-labelledby="fix-workspace-title">
    <div className="lc-fix-intro"><div><span className="lc-fix-symbol" aria-hidden="true">↳</span><h2 id="fix-workspace-title">{text.fixes.title}</h2><p>{text.fixes.intro}</p></div><Link className="lc-text-link" href="/tools/link-preview">{text.previewAction}</Link></div>
    {isFixture(report.id) && <p className="lc-fixture-tag">{text.fixes.example}</p>}
    <div className="lc-fix-grid"><fieldset><legend>{text.fixes.select}</legend><div className="lc-fix-select-actions"><button type="button" onClick={() => { setSelected(new Set(report.findings.map(f => f.id))); setMessage(""); }}>{text.fixes.all}</button><button type="button" onClick={() => { setSelected(new Set(report.findings.filter(f => launchCheckFixArea(f.ruleId) === "page").map(f => f.id))); setMessage(""); }}>{text.fixes.pageOnly}</button><button type="button" onClick={() => { setSelected(new Set()); setMessage(""); }}>{text.fixes.none}</button><span>{chosen.length} {text.fixes.selected}</span></div>{report.findings.map(f => <label key={f.id} className="lc-fix-choice"><input type="checkbox" checked={selected.has(f.id)} onChange={() => select(f.id)}/><span><strong>{f.title}</strong><small>{copy.severity[f.severity]}</small><span className="lc-fix-area">{copy.fixAreas[launchCheckFixArea(f.ruleId)]}</span><span>{f.fix}</span></span></label>)}</fieldset>
    <div className="lc-fix-handoff"><ol>{text.fixes.guide.map(item => <li key={item}>{item}</li>)}</ol><button type="button" className="lc-button" disabled={!chosen.length} onClick={copyPack}>{text.fixes.ai}<span aria-hidden="true">↗</span></button><button type="button" className="lc-button lc-button-quiet" disabled={!chosen.length} onClick={() => { saveFile(new Blob([pack()], { type: "text/markdown;charset=utf-8" }), `launcheck-fixes-${report.id.replace(/[^a-zA-Z0-9_-]/g, "_")}.md`); setMessage(text.fixes.downloaded); }}>{text.fixes.download}</button>{!chosen.length && <p>{text.fixes.empty}</p>}<p className="lc-small">{text.fixes.note}</p>{message && <p role="status">{message}</p>}</div></div>
    <details ref={preview} className="lc-fix-pack-preview"><summary>{text.fixes.preview}</summary><FixPackText key={chosen.map(f => f.id).join("|")} report={{ ...report, findings: chosen }} manual={manual}/></details>
  </section>;
}
function FixPackText({ report, manual }: { report: Report; manual: boolean }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const content = fixBrief(report, origin ? `${origin}/check/${encodeURIComponent(report.id)}` : "");
  return <textarea aria-label={text.fixes.preview} rows={12} readOnly value={content} onFocus={event => { if (manual) event.currentTarget.select(); }}/>;
}
