"use client";
import { useState } from "react";
import type { Evidence } from "./contract";
import { imageSource, timestamp, usd } from "./format";
import { copy } from "./copy";
export function EvidenceImage({ evidence, narrow = false }: { evidence?: Evidence; narrow?: boolean }) {
  const [failedSrc, setFailedSrc] = useState<string>(); const src = imageSource(evidence?.blobUrl); const failed = !!src && src === failedSrc;
  return <figure className={`lc-capture ${narrow ? "lc-capture-narrow" : ""}`}><div className="lc-capture-label">{narrow ? copy.narrow : copy.desktop}</div>{src && !failed ? <a href={src} target="_blank" rel="noopener noreferrer" aria-label={copy.openImage}><img src={src} alt={evidence?.label ?? copy.captureTitle} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedSrc(src)}/></a> : <div className="lc-no-capture"><span aria-hidden="true">×</span><p>{failed ? copy.unavailableImage : copy.captureMissing}</p></div>}<figcaption>{narrow ? copy.narrowScope : evidence?.scopeNote ?? copy.captureScope}{evidence && <span>{copy.observed}: {timestamp(evidence.capturedAt)}</span>}</figcaption></figure>;
}
export function EvidenceRecord({ item, paidUsd }: { item: Evidence; paidUsd?: number | null }) {
  return <div className="lc-evidence-record"><h4>{item.label}</h4><dl><div><dt>{copy.source}</dt><dd>{item.source.type === "free" ? `${copy.byLaunchCheck} / ${copy.free}` : `${item.source.vendorHost}${paidUsd === null ? ` / ${copy.receiptStates.payment_unknown}` : paidUsd !== undefined ? ` / ${usd(paidUsd)}` : ""}`}</dd></div><div><dt>{copy.endpointLabel}</dt><dd>{item.source.endpoint ?? copy.byLaunchCheck}</dd></div><div><dt>{copy.scope}</dt><dd>{item.scopeNote ?? copy.notRecorded}</dd></div><div><dt>{copy.captured}</dt><dd>{timestamp(item.capturedAt)}</dd></div><div><dt>{copy.hash}</dt><dd><code>{item.sha256}</code></dd></div></dl><details><summary>{copy.raw}</summary><pre>{JSON.stringify({ ...item, blobUrl: item.blobUrl?.startsWith("data:") ? copy.embeddedImage : item.blobUrl }, null, 2)}</pre></details></div>;
}
