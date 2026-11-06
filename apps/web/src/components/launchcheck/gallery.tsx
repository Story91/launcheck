"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { GalleryItem } from "./contract";
import { readGallery } from "./api";
import { imageSource, shortDate, usd, websiteLabel } from "./format";
import { copy } from "./copy";
export function Gallery({ fixture = false, limit }: { fixture?: boolean; limit?: number }) {
  const [items, setItems] = useState<GalleryItem[] | null>(null); const [error, setError] = useState(false); const [retry, setRetry] = useState(0);
  useEffect(() => { const controller = new AbortController(); setError(false); setItems(null); readGallery(fixture, AbortSignal.any([controller.signal, AbortSignal.timeout(12000)])).then(data => { if (!controller.signal.aborted) setItems(data.items); }).catch(() => { if (!controller.signal.aborted) setError(true); }); return () => controller.abort(); }, [fixture, retry]);
  if (error) return <div className="lc-recent-empty"><p>{copy.galleryError}</p><button className="lc-text-link" type="button" onClick={() => setRetry(r => r + 1)}>{copy.retry}</button><Link href="/gallery?fixture=1">{copy.fixtureButton}</Link></div>;
  if (!items) return <div className="lc-recent-empty" role="status">{copy.galleryLoading}</div>;
  if (!items.length) return <div className="lc-recent-empty"><p>{copy.galleryEmpty}</p><Link href="/#start">{copy.start}</Link></div>;
  return <>{fixture && <p className="lc-demo-notice">{copy.fixtureNotice}</p>}<div className="lc-recent-grid">{items.slice(0, limit ?? items.length).map(item => <Link className="lc-recent-card" href={`/check/${encodeURIComponent(item.id)}`} key={item.id}>{imageSource(item.thumbUrl) ? <img src={imageSource(item.thumbUrl)} alt={`${copy.desktop}: ${websiteLabel(item.origin)}`} loading="lazy" referrerPolicy="no-referrer"/> : <div className="lc-thumbnail-empty">{copy.noThumbnail}</div>}<div><span>{shortDate(item.checkedAt)}{item.fixed ? ` / ${copy.fixed}` : ""}</span><h3>{websiteLabel(item.origin)}</h3><p>{item.summary.checksRun === 0 ? copy.noChecks : `${item.summary.problems} ${copy.problems} / ${item.summary.checksRun} ${copy.checks}`}</p><strong>{usd(item.spentUsd)} {copy.spent.toLowerCase()}</strong></div></Link>)}</div></>;
}
