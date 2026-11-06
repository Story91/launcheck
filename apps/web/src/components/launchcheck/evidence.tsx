"use client";
import { useState } from "react";
import type { Evidence } from "./contract";
import { imageSource, safeWebUrl, timestamp, usd } from "./format";
import { copy } from "./copy";
export function EvidenceImage({ evidence, narrow = false }: { evidence?: Evidence; narrow?: boolean }) {
  const [failedSrc, setFailedSrc] = useState<string>(); const src = imageSource(evidence?.blobUrl); const failed = !!src && src === failedSrc;
  return <figure className={`lc-capture ${narrow ? "lc-capture-narrow" : ""}`}><div className="lc-capture-label">{narrow ? copy.narrow : copy.desktop}</div>{src && !failed ? <a href={src} target="_blank" rel="noopener noreferrer" aria-label={copy.openImage}><img src={src} alt={evidence?.label ?? copy.captureTitle} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedSrc(src)}/></a> : <div className="lc-no-capture"><span aria-hidden="true">×</span><p>{failed ? copy.unavailableImage : copy.captureMissing}</p></div>}<figcaption>{narrow ? copy.narrowScope : evidence?.scopeNote ?? copy.captureScope}{evidence && <span>{copy.observed}: {timestamp(evidence.capturedAt)}</span>}</figcaption></figure>;
}
function BrowserSteps({ fields }: { fields: Record<string, unknown> }) {
  if (!Array.isArray(fields.steps)) return null;
  const steps = fields.steps.slice(0, 5).filter((step): step is { action: "open" | "click"; url: string; httpStatus: number | null } => !!step && typeof step === "object" && (step.action === "open" || step.action === "click") && typeof step.url === "string" && !!safeWebUrl(step.url));
  if (!steps.length) return null;
  return <div className="lc-browser-steps"><h4>{copy.browserSteps}</h4><ol>{steps.map((step, i) => <li key={i}><strong>{copy.browserActions[step.action]}</strong><a href={safeWebUrl(step.url)!} target="_blank" rel="noopener noreferrer" className="lc-break">{step.url}</a><span>{copy.http}: {typeof step.httpStatus === "number" ? step.httpStatus : copy.notRecorded}</span></li>)}</ol></div>;
}
export function EvidenceRecord({ item, paidUsd }: { item: Evidence; paidUsd?: number | null }) {
  return <div className="lc-evidence-record"><h4>{item.label}</h4><dl><div><dt>{copy.source}</dt><dd>{item.source.type === "free" ? `${copy.byLaunchCheck} / ${copy.free}` : `${item.source.vendorHost}${paidUsd === null ? ` / ${copy.receiptStates.payment_unknown}` : paidUsd !== undefined ? ` / ${usd(paidUsd)}` : ""}`}</dd></div><div><dt>{copy.endpointLabel}</dt><dd>{item.source.endpoint ?? copy.byLaunchCheck}</dd></div><div><dt>{copy.scope}</dt><dd>{item.scopeNote ?? copy.notRecorded}</dd></div><div><dt>{copy.captured}</dt><dd>{timestamp(item.capturedAt)}</dd></div><div><dt>{copy.hash}</dt><dd><code>{item.sha256}</code></dd></div></dl>{item.checkId === "browser_navigation" && <BrowserSteps fields={item.fields}/>} {item.kind === "image" && imageSource(item.blobUrl) && <a className="lc-text-link" href={imageSource(item.blobUrl)} target="_blank" rel="noopener noreferrer">{copy.openImage}</a>}<details><summary>{copy.raw}</summary><pre>{JSON.stringify({ ...item, blobUrl: item.blobUrl?.startsWith("data:") ? copy.embeddedImage : item.blobUrl }, null, 2)}</pre></details></div>;
}
