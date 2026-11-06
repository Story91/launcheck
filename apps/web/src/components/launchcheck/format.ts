import { copy } from "./copy";
export const usd = (value: number) => `$${value.toFixed(Math.abs(value * 100 - Math.round(value * 100)) > 0.00001 ? 3 : 2)}`;
export function safeWebUrl(input: string): string | null { try { const url = new URL(input); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; } }
export function normalizeTarget(input: string): string {
  const value = input.trim(); const url = safeWebUrl(/^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`);
  if (!url) throw new Error(copy.invalid);
  const parsed = new URL(url); const host = parsed.hostname.toLowerCase();
  if (!host.includes(".") || host === "localhost" || host.endsWith(".local") || host.endsWith(".localhost") || /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(":")) throw new Error(copy.local);
  if (parsed.port && !["80", "443"].includes(parsed.port)) throw new Error(copy.port);
  if (parsed.search) throw new Error(copy.query);
  parsed.hash = ""; return parsed.href;
}
export function websiteLabel(value: string): string { try { return new URL(value).hostname; } catch { return value; } }
export function isActive(status: string) { return !["done", "failed", "unreachable"].includes(status); }
export function imageSource(url?: string | null): string | undefined { if (!url) return undefined; if (/^\/[^/]/.test(url)) return url; if (/^data:image\/(png|jpeg|webp);base64,[a-z\d+/=]+$/i.test(url)) return url; const safe = safeWebUrl(url); return safe?.startsWith("https:") ? safe : undefined; }
export function timestamp(value?: string | null) { if (!value) return copy.notRecorded; const date = new Date(value); return Number.isNaN(date.valueOf()) ? copy.notRecorded : new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(date) + " UTC"; }
export function shortDate(value: string) { const date = new Date(value); return Number.isNaN(date.valueOf()) ? copy.notRecorded : new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(date); }
export function explorerUrl(value: string | null): string | null { const url = value && safeWebUrl(value); if (!url) return null; const parsed = new URL(url); return parsed.protocol === "https:" && parsed.hostname === "basescan.org" && /^\/tx\/0x[a-f\d]{64}$/i.test(parsed.pathname) ? url : null; }
export const isFixture = (id: string) => /^fx_(problems|clean|unreachable|running|fixed)$/.test(id);
export function escapeXml(value: string) { return value.replace(/[<>&"']/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c]!)); }
