// Shared shapes for the LaunCheck executor: free checks (our server) and paid checks (bought through Kite) both
// produce CheckOutcome values that the pipeline assembles into a LaunchCheckReport.
import type { LaunchCheckCheck, LaunchCheckEvidence, LaunchCheckFinding } from "./types";

export interface CheckOutcome {
  check: LaunchCheckCheck;
  evidence: LaunchCheckEvidence[];
  findings: LaunchCheckFinding[];
}

/** Injected I/O so free checks are testable without the network. */
export interface FreeCheckDeps {
  fetchImpl: typeof fetch;
  /** DNS A/AAAA lookup used by the SSRF guard; returns every address of the host. */
  lookup: (host: string) => Promise<string[]>;
  /** TXT records; throws on SERVFAIL/timeout, returns [] for NXDOMAIN/no data. */
  resolveTxt: (name: string) => Promise<string[][]>;
  /** TLS peer certificate of host:443, or throws with an error code. */
  peerCertificate: (host: string) => Promise<{ issuer: string; validFrom: string; validTo: string; subjectAltNames: string[] }>;
  now: () => Date;
  /** Vercel region label shown on free evidence, e.g. "iad1". */
  region: string;
}

export interface FreeChecksResult {
  /** True when the page itself could not be fetched (DNS failure, timeout, blocked address): the run stops at $0. */
  unreachable: boolean;
  error: string | null;
  /** Final URL after redirects (null when unreachable). */
  finalUrl: string | null;
  outcomes: CheckOutcome[];
  /** Links that answered 403/429/timeout from our server: candidates for the paid outside probe. */
  blockedLinks: string[];
  /** Number of links found in the static HTML (for "checked 10 of N"). */
  linksFound: number;
}

/** Thrown by the SSRF guard; mapped to POST /api/checks 403 {error:"blocked_url", reason}. */
export class BlockedUrlError extends Error {
  constructor(public readonly reason: "private_address" | "bad_scheme" | "bad_port" | "credentials_in_url") {
    super(`blocked url: ${reason}`);
    this.name = "BlockedUrlError";
  }
}
