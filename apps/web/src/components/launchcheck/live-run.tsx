"use client";
import { useEffect, useState } from "react";
import type { Report } from "./contract";
import { readReport } from "./api";
import { ReportView } from "./report";
import { isActive, isFixture } from "./format";
import { fixtureReport } from "./mocks/fixtures";
import { copy } from "./copy";
export function LiveRun({ id, initial, cached = false, rerunEstimateUsd }: { id: string; initial?: Report | null; cached?: boolean; rerunEstimateUsd?: number }) {
  const [report, setReport] = useState<Report | null>(initial ?? (isFixture(id) ? fixtureReport(id, id === "fx_running" ? 0 : 5) : null)); const [error, setError] = useState(""); const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>; let stopped = false; setError("");
    async function poll() { try { const result = await readReport(id, AbortSignal.any([controller.signal, AbortSignal.timeout(15000)])); if (stopped) return; setReport(result); setError(""); if (isActive(result.status)) timer = setTimeout(poll, 2000); } catch (e) { if (!stopped) setError(e instanceof Error ? e.message : copy.api.unavailable); } }
    void poll(); return () => { stopped = true; controller.abort(); clearTimeout(timer); };
  }, [id, retry]);
  return <>{error && <div className="lc-error" role="alert"><p>{copy.pauseUpdates}. {error}</p><p>{copy.noNewCharge}</p><button className="lc-button lc-button-quiet" type="button" onClick={() => setRetry(r => r + 1)}>{copy.retryStatus}</button></div>}{!report && !error && <div className="lc-loading" role="status"><h1>{copy.waiting}</h1></div>}{report && <ReportView report={report} cached={cached} rerunEstimateUsd={rerunEstimateUsd}/>}</>;
}
