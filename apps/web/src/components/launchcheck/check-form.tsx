"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createCheck, readAgent, readCatalog } from "./api";
import type { AgentStatus, Catalog, Tier, Venue } from "./contract";
import { normalizeTarget, timestamp, usd } from "./format";
import { fixtureAgent, fixtureCatalog } from "./mocks/fixtures";
import { copy } from "./copy";
import { Globe } from "./icons";

export function AgentCard({ agent, fixture = false }: { agent: AgentStatus | null; fixture?: boolean }) {
  return <aside className="lc-agent"><div className="lc-agent-heading"><h2>{copy.agentTitle}</h2><span className={`lc-agent-state ${agent?.executor.online ? "lc-online" : ""}`}>{agent ? agent.executor.online ? copy.online : copy.offline : copy.agentUnknown}</span></div>{fixture && <p className="lc-fixture-tag">{copy.fixture}</p>}{agent ? <><dl className="lc-agent-identity"><div><dt>{copy.identity}</dt><dd title={agent.agent.kiteAgentId}>{agent.agent.kiteAgentId.length > 20 ? `${agent.agent.kiteAgentId.slice(0, 9)}…${agent.agent.kiteAgentId.slice(-6)}` : agent.agent.kiteAgentId}</dd></div><div><dt>{copy.owner}</dt><dd>{agent.agent.ownerMasked}</dd></div><div><dt>{copy.executor}</dt><dd>{agent.executor.where}</dd></div></dl><div className="lc-agent-budget"><div><span>{copy.allowance}</span><strong>{agent.allowance ? `${usd(agent.allowance.leftUsd)} / ${usd(agent.allowance.limitUsd)}` : copy.allowanceUnknown}</strong></div>{agent.allowance && <><progress aria-label={copy.allowance} max={agent.allowance.limitUsd || 1} value={agent.allowance.leftUsd}/><p>{copy.readAt}: {timestamp(agent.allowance.readAt)}<br/>{copy.resets}: {timestamp(agent.allowance.resetsAt)}</p></>}</div><div className="lc-agent-budget"><div><span>{copy.demoBudget}</span><strong>{usd(agent.demo.leftUsd)} / {usd(agent.demo.capUsd)}</strong></div><progress aria-label={copy.demoBudget} max={agent.demo.capUsd || 1} value={agent.demo.leftUsd}/><p>{copy.resets}: {timestamp(agent.demo.resetsAt)}</p></div>{!agent.liveRuns && <p className="lc-small">{copy.livePaused}</p>}</> : <p className="lc-small lc-muted">{copy.unknownHint}</p>}</aside>;
}
export function CheckForm({ initialUrl = "", fixture = false, compact = false }: { initialUrl?: string; fixture?: boolean; compact?: boolean }) {
  const router = useRouter(); const [url, setUrl] = useState(initialUrl); const [tier, setTier] = useState<Tier>("standard"); const [venue, setVenue] = useState<Venue>("product_hunt"); const [consent, setConsent] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [catalog, setCatalog] = useState<Catalog | null>(fixture ? fixtureCatalog : null); const [agent, setAgent] = useState<AgentStatus | null>(fixture ? fixtureAgent : null); const [loading, setLoading] = useState(!fixture); const [retry, setRetry] = useState(0); const locked = useRef(false);
  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    Promise.allSettled([readCatalog(AbortSignal.any([controller.signal, AbortSignal.timeout(12000)])), readAgent(fixture, AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]))]).then(([menu, identity]) => { if (controller.signal.aborted) return; setCatalog(menu.status === "fulfilled" ? menu.value : null); setAgent(identity.status === "fulfilled" ? identity.value : null); if (menu.status === "fulfilled") setTier(menu.value.tiers.find(t => t.default)?.id ?? menu.value.tiers[0].id); setLoading(false); });
    return () => controller.abort();
  }, [fixture, retry]);
  const selected = catalog?.tiers.find(t => t.id === tier); const canRun = fixture || !!(catalog && selected && agent?.liveRuns && agent.executor.online && agent.allowance && agent.allowance.leftUsd >= selected.budgetUsd && agent.demo.leftUsd >= selected.budgetUsd);
  async function submit(event: FormEvent) { event.preventDefault(); if (locked.current || !canRun) return; setError(""); let target: string; try { target = normalizeTarget(url); } catch (e) { setError((e as Error).message); return; } if (!consent) { setError(copy.confirm); return; } if (fixture) { router.push("/check/fx_running"); return; }
    locked.current = true; setBusy(true); try { const run = await createCheck(target, tier, venue, AbortSignal.timeout(30000)); const params = new URLSearchParams(); if (run.cached) { params.set("cached", "1"); if (run.checkedAt) params.set("checkedAt", run.checkedAt); if (run.rerunEstimateUsd !== undefined) params.set("estimate", String(run.rerunEstimateUsd)); } router.push(`/check/${encodeURIComponent(run.id)}${params.size ? `?${params}` : ""}`); } catch (e) { setError(e instanceof Error && e.name === "TimeoutError" ? copy.api.timeout : e instanceof Error ? e.message : copy.api.unavailable); locked.current = false; setBusy(false); }
  }
  return <div className={`lc-start-grid ${compact ? "lc-start-compact" : ""}`}><form className="lc-check-form" onSubmit={submit} noValidate>
    {fixture && <p className="lc-fixture-tag">{copy.fixtureNotice}</p>}
    <label htmlFor="check-url">{copy.urlLabel}</label><div className="lc-field"><Globe/><input id="check-url" name="url" value={url} onChange={e => { setUrl(e.target.value); setError(""); }} placeholder={copy.placeholder} autoComplete="url" inputMode="url" required disabled={busy} aria-describedby="url-help"/></div><p id="url-help" className="lc-small lc-muted">{copy.urlHelp}</p>
    <label htmlFor="venue">{copy.venue}</label><select id="venue" name="venue" value={venue} onChange={e => setVenue(e.target.value as Venue)} disabled={busy}>{Object.entries(copy.venues).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
    {catalog ? <><fieldset className="lc-tiers"><legend>{copy.budget}</legend>{catalog.tiers.map(item => <label key={item.id} className={tier === item.id ? "lc-tier-selected" : ""}><input type="radio" name="tier" value={item.id} checked={tier === item.id} onChange={() => setTier(item.id)} disabled={busy}/><span>{item.label}</span><strong>{usd(item.budgetUsd)}</strong></label>)}</fieldset><p className="lc-small">{copy.spending} <strong>{usd(selected?.budgetUsd ?? 0)}</strong>. {copy.stops}</p><details className="lc-menu"><summary>{copy.catalog}</summary><ul>{catalog.checks.filter(c => c.kind === "free" || c.tiers?.includes(tier)).map(c => <li key={c.checkId}><span>{c.label}</span><strong>{c.kind === "free" ? copy.free : usd(c.priceUsd)}</strong></li>)}</ul></details></> : <p className="lc-service-message" role="status">{loading ? copy.loadCatalog : copy.noCatalog}</p>}
    <label className="lc-consent"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} disabled={busy}/><span>{copy.consent}</span></label>
    {error && <div className="lc-error" role="alert"><p>{error}</p><Link href="/gallery">{copy.viewGallery}</Link></div>}
    <button className="lc-button lc-wide" type="submit" disabled={busy || !canRun} aria-busy={busy}>{busy ? copy.startBusy : fixture ? copy.walkthrough : copy.start}</button>
    {!canRun && !loading && <div className="lc-form-fallback"><p>{agent?.executor.online === false ? copy.offline : copy.livePaused}</p><button className="lc-text-link" type="button" onClick={() => setRetry(r => r + 1)}>{copy.retry}</button><Link href="/check/fx_problems">{copy.fixtureButton}</Link></div>}
  </form><AgentCard agent={agent} fixture={fixture}/></div>;
}
