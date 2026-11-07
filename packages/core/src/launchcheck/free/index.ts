// Entry point of the free LaunCheck checks: page_fetch first; if the page is unreachable the run stops at $0,
// otherwise the remaining checks run in parallel and come back in the spec table order (section 4.1).
import { BlockedUrlError, type CheckOutcome, type FreeCheckDeps, type FreeChecksResult } from "../engine";
import {
  LAUNCHCHECK_FREE_CHECK_LABELS,
  LAUNCHCHECK_TIMEOUT_SECONDS,
  freeCheckEmailDns,
  freeCheckLinkStatus,
  freeCheckOgImageFetch,
  freeCheckPageFetch,
  freeCheckSecurityHeaders,
  freeCheckShareTags,
  freeCheckTlsCert,
  loadLaunchCheckFreePage,
  type LaunchCheckFreeCheckId,
  type LaunchCheckFreePage,
} from "./checks";
import { LAUNCHCHECK_MAX_REDIRECTS, classifyLaunchCheckFetchError } from "./ssrf";

export * from "./ssrf";
export * from "./checks";

function unreachableMessage(err: unknown, url: string, deps: FreeCheckDeps): string {
  let host = url;
  try { host = new URL(url).hostname; } catch { /* keep raw input */ }
  if (err instanceof BlockedUrlError) {
    const why: Record<BlockedUrlError["reason"], string> = {
      private_address: "it points to a private or local network address",
      bad_scheme: "only http:// and https:// addresses can be fetched",
      bad_port: "only the default ports 80 and 443 can be fetched",
      credentials_in_url: "the address contains a user name or password",
    };
    return `We did not fetch ${url} because ${why[err.reason]}. No paid services were purchased.`;
  }
  switch (classifyLaunchCheckFetchError(err)) {
    case "timeout":
      return `The page did not respond within ${LAUNCHCHECK_TIMEOUT_SECONDS} seconds from Vercel ${deps.region}. No paid services were purchased.`;
    case "dns":
      return `We could not resolve the host name ${host} from Vercel ${deps.region}. No paid services were purchased.`;
    case "redirect_limit":
      return `The page redirected more than ${LAUNCHCHECK_MAX_REDIRECTS} times, so we stopped following it. No paid services were purchased.`;
    default:
      return `We could not connect to ${host} from Vercel ${deps.region}. No paid services were purchased.`;
  }
}

/** Wraps one check so an unexpected exception becomes a "Couldn't check" outcome instead of failing the run. */
async function guarded<T extends CheckOutcome>(checkId: LaunchCheckFreeCheckId, deps: FreeCheckDeps, run: () => Promise<T>): Promise<CheckOutcome> {
  try {
    return await run();
  } catch (err) {
    const timedOut = classifyLaunchCheckFetchError(err) === "timeout";
    return {
      check: { checkId, label: LAUNCHCHECK_FREE_CHECK_LABELS[checkId], kind: "free", state: "not_checked", notCheckedReason: timedOut ? "timeout" : "blocked_from_our_server", evidenceIds: [], scopeNote: `checked from Vercel ${deps.region}` },
      evidence: [],
      findings: [],
    };
  }
}

export async function runFreeChecks(url: string, deps: FreeCheckDeps): Promise<FreeChecksResult> {
  let page: LaunchCheckFreePage;
  try {
    page = await loadLaunchCheckFreePage(url, deps);
  } catch (err) {
    return { unreachable: true, error: unreachableMessage(err, url, deps), finalUrl: null, outcomes: [], blockedLinks: [], linksFound: 0 };
  }
  let blockedLinks: string[] = [];
  // An error/challenge page is not evidence about the intended page's HTML or headers.
  const pageContentAvailable = page.response.status >= 200 && page.response.status < 300;
  const pageContentCheck = (checkId: LaunchCheckFreeCheckId, run: () => Promise<CheckOutcome>): Promise<CheckOutcome> => {
    if (pageContentAvailable) return guarded(checkId, deps, run);
    return Promise.resolve({
      check: { checkId, label: LAUNCHCHECK_FREE_CHECK_LABELS[checkId], kind: "free", state: "not_checked", notCheckedReason: "not_applicable", evidenceIds: [], scopeNote: `Not evaluated: the page request returned HTTP ${page.response.status}; its response may be an error or access-challenge page.` },
      evidence: [], findings: [],
    });
  };
  const outcomes = await Promise.all([
    guarded("page_fetch", deps, () => freeCheckPageFetch(page, deps)),
    pageContentCheck("security_headers", () => freeCheckSecurityHeaders(page, deps)),
    guarded("tls_cert", deps, () => freeCheckTlsCert(page, deps)),
    pageContentCheck("share_tags", () => freeCheckShareTags(page, deps)),
    pageContentCheck("og_image_fetch", () => freeCheckOgImageFetch(page, deps)),
    guarded("email_dns", deps, () => freeCheckEmailDns(page, deps)),
    pageContentCheck("link_status", async () => {
      const { blockedLinks: blocked, ...outcome } = await freeCheckLinkStatus(page, deps);
      blockedLinks = blocked;
      return outcome;
    }),
  ]);
  return { unreachable: false, error: null, finalUrl: page.response.finalUrl, outcomes, blockedLinks, linksFound: page.html.links.length };
}
