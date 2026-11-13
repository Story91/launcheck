// Where a finding gets changed. A report lists page tags next to hosting and DNS observations; the reader needs to
// know which ones a page edit can remove and which ones live in server settings, DNS or the certificate.

export type LaunchCheckFixArea = "page" | "server" | "dns" | "certificate";

const AREA_BY_RULE: Record<string, LaunchCheckFixArea> = {
  hsts_missing: "server",
  csp_missing: "server",
  xcto_missing: "server",
  http_not_redirected: "server",
  page_status_error: "server",
  browser_navigation_http_error: "server",
  spf_missing: "dns",
  dmarc_missing: "dns",
  dmarc_p_none: "dns",
  cert_expiring: "certificate",
  cert_host_mismatch: "certificate",
};

/** Area for a rule id; rules without an entry are page content (tags, links, images). */
export function launchCheckFixArea(ruleId: string): LaunchCheckFixArea {
  return AREA_BY_RULE[ruleId] ?? "page";
}

/** Platforms that hand out subdomains: the site owner cannot publish DNS records under these names. */
const SHARED_HOSTING_SUFFIXES = [
  "vercel.app", "netlify.app", "pages.dev", "workers.dev", "github.io", "gitlab.io", "web.app", "firebaseapp.com",
  "onrender.com", "fly.dev", "herokuapp.com", "railway.app", "replit.app", "lovable.app", "surge.sh", "glitch.me",
  "azurewebsites.net", "amplifyapp.com",
] as const;

/** The platform suffix when `host` is a subdomain of a hosting platform, otherwise null. */
export function launchCheckSharedHostingSuffix(host: string): string | null {
  const h = host.toLowerCase().replace(/\.$/, "");
  return SHARED_HOSTING_SUFFIXES.find((suffix) => h.endsWith(`.${suffix}`)) ?? null;
}
