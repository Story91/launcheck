import type { Report } from "./contract";
import { isFixture } from "./format";
import { copy } from "./copy";

export function evidenceExport(report: Report, reportUrl: string) {
  const { isRequester: _ownership, ...observations } = report;
  return JSON.stringify({ format: "launchcheck-evidence.v1", reportUrl, note: copy.evidenceExportNote, report: observations }, null, 2);
}
export function exportFilename(id: string, kind: "png" | "json") {
  return `launchcheck-${isFixture(id) ? "example-" : ""}${id.replace(/[^a-zA-Z0-9_-]/g, "_")}.${kind}`;
}
export async function receiptPng(id: string): Promise<Blob> {
  const response = await fetch(`/check/${encodeURIComponent(id)}/opengraph-image`, { cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!response.ok || !response.headers.get("content-type")?.startsWith("image/png")) throw new Error(copy.exportFailed);
  const blob = await response.blob();
  if (!blob.size || blob.size > 8_000_000) throw new Error(copy.exportFailed);
  return blob;
}
export function saveFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
