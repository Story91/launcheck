import type { AuditEntry } from "@tenderhound/core";

export function AuditTable({ audit, costUsd, droppedEvidence }: { audit: AuditEntry[]; costUsd: number; droppedEvidence: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-mist">
          <tr>
            <th className="py-2 pr-4 font-normal">Step</th>
            <th className="py-2 pr-4 font-normal">Model</th>
            <th className="py-2 pr-4 font-normal">Prompt</th>
            <th className="py-2 pr-4 font-normal">SERV request id</th>
            <th className="py-2 pr-4 text-right font-normal">Tokens in/out</th>
            <th className="py-2 pr-4 text-right font-normal">Cost</th>
            <th className="py-2 text-right font-normal">Time</th>
          </tr>
        </thead>
        <tbody>
          {audit.map((a, i) => (
            <tr key={i} className="border-t border-rule align-top">
              <td className="py-2 pr-4">
                {a.step}
                {a.note && <div className="text-xs text-amber">{a.note}</div>}
              </td>
              <td className="py-2 pr-4">{a.model}</td>
              <td className="py-2 pr-4">{a.promptVersion}</td>
              <td className="py-2 pr-4">
                {a.requestId ? (
                  <a className="text-tide underline-offset-2 hover:underline" href="https://console.openserv.ai/usage" target="_blank" rel="noreferrer">
                    {a.requestId}
                  </a>
                ) : (
                  <span className="text-mist">—</span>
                )}
              </td>
              <td className="py-2 pr-4 text-right tabular-nums">
                {a.usage.promptTokens}/{a.usage.completionTokens}
              </td>
              <td className="py-2 pr-4 text-right tabular-nums">{a.costUsd == null ? "—" : `$${a.costUsd.toFixed(4)}`}</td>
              <td className="py-2 text-right tabular-nums">{a.durationMs} ms</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-sm text-slate">
        Total cost ${costUsd.toFixed(4)} · {droppedEvidence} quote{droppedEvidence === 1 ? "" : "s"} dropped as non-verbatim
      </p>
    </div>
  );
}
