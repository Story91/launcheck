// SSRF guard and the only fetch the free checks use. Every hop of every request is re-validated: scheme, port,
// credentials and every resolved address. Redirects are followed manually so no hop escapes the guard.
// Known limit: the address is resolved by `lookup` and again by fetchImpl, so a DNS-rebinding host could answer
// differently between the two lookups. Pinning the socket to the checked address needs a custom dispatcher.
import { isIP } from "node:net";
import { BlockedUrlError, type FreeCheckDeps } from "../engine";

export const LAUNCHCHECK_FETCH_TIMEOUT_MS = 8_000;
export const LAUNCHCHECK_MAX_BODY_BYTES = 2 * 1024 * 1024;
export const LAUNCHCHECK_MAX_REDIRECTS = 5;

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function parseIPv4(s: string): number[] | null {
  const parts = s.split(".");
  if (parts.length !== 4) return null;
  const out: number[] = [];
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = Number(p);
    if (n > 255) return null;
    out.push(n);
  }
  return out;
}

function isBlockedIPv4(o: number[]): boolean {
  const [a = 0, b = 0, c = 0] = o;
  return (
    a === 0 || // 0.0.0.0/8 "this network"
    a === 10 || // private
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // CGNAT 100.64/10
    (a === 169 && b === 254) || // link-local, cloud metadata
    (a === 172 && b >= 16 && b <= 31) || // private
    (a === 192 && b === 168) || // private
    (a === 192 && b === 0 && c === 0) || // IETF protocol assignments
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    a >= 224 // multicast 224/4 and reserved 240/4, broadcast
  );
}

/** Parses an IPv6 literal into eight 16-bit groups (zone id ignored, embedded IPv4 tail supported). */
function parseIPv6(input: string): number[] | null {
  let s = input.split("%")[0]!.toLowerCase();
  let tail: number[] = [];
  const lastColon = s.lastIndexOf(":");
  if (s.includes(".")) {
    const v4 = parseIPv4(s.slice(lastColon + 1));
    if (!v4) return null;
    tail = [(v4[0]! << 8) | v4[1]!, (v4[2]! << 8) | v4[3]!];
    s = s.slice(0, lastColon + 1); // keep "::" intact, drop a single trailing ":"
    if (!s.endsWith("::")) s = s.slice(0, -1);
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const toGroups = (h: string) => (h === "" ? [] : h.split(":"));
  const head = toGroups(halves[0]!);
  const rest = halves.length === 2 ? toGroups(halves[1]!) : [];
  const parse = (g: string) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN);
  const headN = head.map(parse);
  const restN = rest.map(parse);
  if ([...headN, ...restN].some(Number.isNaN)) return null;
  const known = headN.length + restN.length + tail.length;
  if (halves.length === 1) {
    if (known !== 8) return null;
    return [...headN, ...tail];
  }
  if (known > 7) return null;
  return [...headN, ...new Array<number>(8 - known).fill(0), ...restN, ...tail];
}

const v4From = (hi: number, lo: number) => [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff];

function isBlockedIPv6(g: number[]): boolean {
  const zeros = (from: number, to: number) => g.slice(from, to).every((x) => x === 0);
  if (zeros(0, 8)) return true; // ::
  if (zeros(0, 7) && g[7] === 1) return true; // ::1
  const first = g[0]!;
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((first & 0xffc0) === 0xfec0) return true; // fec0::/10 deprecated site-local
  if ((first & 0xff00) === 0xff00) return true; // multicast
  if (zeros(0, 5) && (g[5] === 0xffff || g[5] === 0)) return isBlockedIPv4(v4From(g[6]!, g[7]!)); // mapped / compatible
  if (zeros(0, 4) && g[4] === 0xffff && g[5] === 0) return isBlockedIPv4(v4From(g[6]!, g[7]!)); // translated
  if (first === 0x64 && g[1] === 0xff9b && zeros(2, 6)) return isBlockedIPv4(v4From(g[6]!, g[7]!)); // NAT64
  if (first === 0x2002) return isBlockedIPv4(v4From(g[1]!, g[2]!)); // 6to4
  if (first === 0x2001 && g[1] === 0x0db8) return true; // documentation
  return false;
}

/** True for any address we must never fetch (loopback, private, link-local, CGNAT, multicast, ...). Fails closed. */
export function isBlockedAddress(ip: string): boolean {
  const bare = ip.startsWith("[") && ip.endsWith("]") ? ip.slice(1, -1) : ip;
  const family = isIP(bare.split("%")[0]!);
  if (family === 4) return isBlockedIPv4(parseIPv4(bare)!);
  if (family === 6) {
    const groups = parseIPv6(bare);
    return groups ? isBlockedIPv6(groups) : true;
  }
  return true;
}

function dnsError(host: string): Error {
  return Object.assign(new Error(`getaddrinfo ENOTFOUND ${host}`), { code: "ENOTFOUND", hostname: host });
}

/**
 * Validates a URL for an outbound request: http/https only, no credentials, default ports (80/443) only, and every
 * resolved address public. Throws BlockedUrlError; DNS failures from `lookup` propagate unchanged.
 */
export async function assertPublicUrl(input: string | URL, lookup: FreeCheckDeps["lookup"]): Promise<URL> {
  const url = new URL(String(input));
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new BlockedUrlError("bad_scheme");
  if (url.username !== "" || url.password !== "") throw new BlockedUrlError("credentials_in_url");
  if (url.port !== "" && url.port !== "80" && url.port !== "443") throw new BlockedUrlError("bad_port");
  const host = url.hostname.startsWith("[") ? url.hostname.slice(1, -1) : url.hostname;
  if (isIP(host)) {
    if (isBlockedAddress(host)) throw new BlockedUrlError("private_address");
    return url;
  }
  const lower = host.toLowerCase().replace(/\.$/, "");
  if (lower === "localhost" || lower.endsWith(".localhost")) throw new BlockedUrlError("private_address");
  const addresses = await lookup(host);
  if (addresses.length === 0) throw dnsError(host);
  if (addresses.some(isBlockedAddress)) throw new BlockedUrlError("private_address");
  return url;
}

export interface SafeFetchOptions {
  method?: "GET" | "HEAD";
  headers?: Record<string, string>;
  /** "text": decode the body (capped); "count": read and count bytes only; "none": do not read it. */
  body?: "text" | "count" | "none";
  maxRedirects?: number;
  timeoutMs?: number;
  maxBytes?: number;
}

export interface SafeFetchHop {
  url: string;
  status: number;
  location: string;
}

export interface SafeFetchResult {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  /** Response headers of the final hop, lower-case names. */
  headers: Record<string, string>;
  redirectChain: SafeFetchHop[];
  bodyText: string | null;
  bodyBytes: number | null;
  truncated: boolean;
  elapsedMs: number;
}

export class TooManyRedirectsError extends Error {
  constructor(public readonly chain: SafeFetchHop[]) {
    super(`more than ${chain.length - 1} redirects`);
    this.name = "TooManyRedirectsError";
  }
}

function raceSignal<T>(p: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    p.then(
      (v) => { signal.removeEventListener("abort", onAbort); resolve(v); },
      (e) => { signal.removeEventListener("abort", onAbort); reject(e); },
    );
  });
}

async function readCapped(res: Response, maxBytes: number): Promise<{ bytes: Uint8Array; truncated: boolean }> {
  if (!res.body) return { bytes: new Uint8Array(0), truncated: false };
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const room = maxBytes - total;
    if (value.byteLength > room) {
      chunks.push(value.subarray(0, room));
      total += room;
      truncated = true;
      void reader.cancel().catch(() => {});
      break;
    }
    chunks.push(value);
    total += value.byteLength;
  }
  const bytes = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { bytes.set(c, off); off += c.byteLength; }
  return { bytes, truncated };
}

/** Fetch through the SSRF guard: manual redirects (each hop re-checked), one timeout for the whole chain, body cap. */
export async function safeFetch(
  url: string,
  deps: Pick<FreeCheckDeps, "fetchImpl" | "lookup">,
  opts: SafeFetchOptions = {},
): Promise<SafeFetchResult> {
  const method = opts.method ?? "GET";
  const maxRedirects = opts.maxRedirects ?? LAUNCHCHECK_MAX_REDIRECTS;
  const maxBytes = opts.maxBytes ?? LAUNCHCHECK_MAX_BODY_BYTES;
  const bodyMode = opts.body ?? "none";
  const signal = AbortSignal.timeout(opts.timeoutMs ?? LAUNCHCHECK_FETCH_TIMEOUT_MS);
  const started = performance.now();
  const chain: SafeFetchHop[] = [];
  let current = (await raceSignal(assertPublicUrl(url, deps.lookup), signal)).href;

  for (;;) {
    const res = await deps.fetchImpl(current, { method, headers: opts.headers, redirect: "manual", signal });
    const location = res.headers.get("location");
    if (REDIRECT_STATUSES.has(res.status) && location) {
      void res.body?.cancel().catch(() => {}); // not awaited: a tee branch only settles when both branches cancel
      const next = new URL(location, current).href;
      chain.push({ url: current, status: res.status, location: next });
      if (chain.length > maxRedirects) throw new TooManyRedirectsError(chain);
      current = (await raceSignal(assertPublicUrl(next, deps.lookup), signal)).href;
      continue;
    }
    const headers: Record<string, string> = {};
    res.headers.forEach((value, key) => { headers[key.toLowerCase()] = value; });
    let bodyText: string | null = null;
    let bodyBytes: number | null = null;
    let truncated = false;
    if (bodyMode !== "none" && method !== "HEAD") {
      const read = await readCapped(res, maxBytes);
      bodyBytes = read.bytes.byteLength;
      truncated = read.truncated;
      if (bodyMode === "text") bodyText = new TextDecoder("utf-8").decode(read.bytes);
    } else {
      void res.body?.cancel().catch(() => {}); // not awaited: a tee branch only settles when both branches cancel
    }
    return {
      requestedUrl: url,
      finalUrl: current,
      status: res.status,
      headers,
      redirectChain: chain,
      bodyText,
      bodyBytes,
      truncated,
      elapsedMs: Math.round(performance.now() - started),
    };
  }
}

export type LaunchCheckFetchFailure = "blocked_url" | "timeout" | "dns" | "redirect_limit" | "network";

/** Maps an error thrown by safeFetch to a coarse failure kind. */
export function classifyLaunchCheckFetchError(err: unknown): LaunchCheckFetchFailure {
  if (err instanceof BlockedUrlError) return "blocked_url";
  if (err instanceof TooManyRedirectsError) return "redirect_limit";
  const e = err as { name?: string; code?: string; cause?: { code?: string } } | null;
  if (e?.name === "TimeoutError" || e?.name === "AbortError") return "timeout";
  const code = e?.code ?? e?.cause?.code;
  if (code === "ETIMEDOUT" || code === "UND_ERR_CONNECT_TIMEOUT" || code === "UND_ERR_HEADERS_TIMEOUT" || code === "ETIMEOUT") return "timeout";
  if (code === "ENOTFOUND" || code === "EAI_AGAIN" || code === "ENODATA") return "dns";
  return "network";
}
