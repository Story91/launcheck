import { describe, expect, it } from "vitest";
import { BlockedUrlError, type CheckOutcome, type FreeCheckDeps } from "../src/launchcheck/engine";
import {
  TooManyRedirectsError,
  assertPublicUrl,
  isBlockedAddress,
  runFreeChecks,
  safeFetch,
} from "../src/launchcheck/free";
import { launchCheckCheckSchema, launchCheckEvidenceSchema, launchCheckFindingSchema } from "../src/launchcheck/types";
import { findBannedWords } from "../src/launchcheck/wording";

// ---------- fakes ----------

type Handler = (init: RequestInit) => Response | Promise<Response>;
type Route = Response | Handler | (() => never);

interface FakeWorld {
  routes: Record<string, Route>;
  hosts?: Record<string, string[]>;
  txt?: Record<string, string[][] | Error>;
  cert?: { issuer: string; validFrom: string; validTo: string; subjectAltNames: string[] } | Error;
}

const NOW = new Date("2026-11-06T14:02:00.000Z");
const PUBLIC_IP = "93.184.216.34";

function makeDeps(world: FakeWorld) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init });
    const route = world.routes[url];
    if (route === undefined) throw new TypeError(`fetch failed: ${url}`);
    if (route instanceof Response) return route.clone();
    return (route as Handler)(init);
  }) as typeof fetch;
  const deps: FreeCheckDeps = {
    fetchImpl,
    lookup: async (host) => {
      const addresses = world.hosts?.[host];
      if (addresses === undefined) return [PUBLIC_IP];
      if (addresses.length === 0) throw Object.assign(new Error(`getaddrinfo ENOTFOUND ${host}`), { code: "ENOTFOUND" });
      return addresses;
    },
    resolveTxt: async (name) => {
      const v = world.txt?.[name];
      if (v instanceof Error) throw v;
      return v ?? [];
    },
    peerCertificate: async () => {
      const c = world.cert ?? { issuer: "Example CA", validFrom: "2026-10-01T00:00:00Z", validTo: "2027-01-30T00:00:00Z", subjectAltNames: ["DNS:example.com", "DNS:*.example.com"] };
      if (c instanceof Error) throw c;
      return c;
    },
    now: () => NOW,
    region: "iad1",
  };
  return { deps, calls };
}

const html = (body: string, head = GOOD_HEAD) =>
  `<!doctype html><html lang="en"><head>${head}</head><body>${body}${"<p>" + "Plenty of static text for the page. ".repeat(80) + "</p>"}</body></html>`;

const GOOD_HEAD = `
  <meta charset="utf-8">
  <title>Example launch</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="An example product">
  <meta property="og:title" content="Example launch">
  <meta property="og:description" content="An example product">
  <meta property="og:image" content="/og.png">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="canonical" href="https://example.com/">`;

const GOOD_BODY = `
  <header><nav><a href="/pricing">Pricing</a><a href="/docs">Docs</a></nav></header>
  <a href="/about">About us</a>
  <a href="mailto:hi@example.com">Mail</a><a href="tel:+100">Call</a><a href="javascript:void(0)">x</a><a href="#top">Top</a>`;

const htmlResponse = (body: string, headers: Record<string, string> = {}, status = 200) =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", ...headers } });

const GOOD_HEADERS = {
  "strict-transport-security": "max-age=31536000",
  "content-security-policy": "default-src 'self'; frame-ancestors 'none'",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
};

const redirect = (to: string, status = 301) => new Response(null, { status, headers: { location: to } });
const ok = () => new Response(null, { status: 200 });
const png = () => new Response(new Uint8Array(1200), { status: 200, headers: { "content-type": "image/png" } });

function goodWorld(overrides: Partial<FakeWorld> = {}, routes: Record<string, Route> = {}): FakeWorld {
  return {
    routes: {
      "https://example.com/": htmlResponse(html(GOOD_BODY), GOOD_HEADERS),
      "http://example.com/": redirect("https://example.com/"),
      "https://example.com/og.png": png(),
      "https://example.com/pricing": ok(),
      "https://example.com/docs": ok(),
      "https://example.com/about": ok(),
      ...routes,
    },
    txt: {
      "example.com": [["v=spf1 include:_spf.example.net ~all"]],
      "_dmarc.example.com": [["v=DMARC1; p=quarantine; rua=mailto:d@example.com"]],
    },
    ...overrides,
  };
}

const byId = (outcomes: CheckOutcome[], id: string) => {
  const o = outcomes.find((x) => x.check.checkId === id);
  if (!o) throw new Error(`missing outcome ${id}`);
  return o;
};
const rules = (o: CheckOutcome) => o.findings.map((f) => f.ruleId);

function userFacingStrings(outcomes: CheckOutcome[]): string[] {
  const out: string[] = [];
  for (const o of outcomes) {
    out.push(o.check.label, o.check.scopeNote ?? "");
    for (const e of o.evidence) out.push(e.label, e.scopeNote ?? "");
    for (const f of o.findings) out.push(f.title, f.observed, f.explanation, f.fix);
  }
  return out;
}

function expectValid(outcomes: CheckOutcome[]) {
  for (const o of outcomes) {
    expect(launchCheckCheckSchema.safeParse(o.check).success).toBe(true);
    expect(o.check.kind).toBe("free");
    for (const e of o.evidence) {
      expect(launchCheckEvidenceSchema.safeParse(e).success).toBe(true);
      expect(e.source).toEqual({ type: "free", vendorHost: null, endpoint: null });
      expect(e.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(e.capturedAt).toBe(NOW.toISOString());
    }
    for (const f of o.findings) {
      expect(launchCheckFindingSchema.safeParse(f).success).toBe(true);
      expect(f.explainedBy).toBe("template");
      expect(f.id.startsWith(`f_${f.ruleId}`)).toBe(true);
      for (const id of f.evidenceIds) expect(o.evidence.map((e) => e.id)).toContain(id);
    }
    for (const id of o.check.evidenceIds) expect(o.evidence.map((e) => e.id)).toContain(id);
    if (o.check.state === "not_checked") expect(o.check.notCheckedReason).not.toBeNull();
    else expect(o.check.notCheckedReason).toBeNull();
    expect(o.check.state).toBe(o.findings.length > 0 ? "problem" : o.check.state);
  }
  expect(userFacingStrings(outcomes).flatMap(findBannedWords)).toEqual([]);
}

// ---------- SSRF guard ----------

describe("isBlockedAddress", () => {
  it.each([
    "127.0.0.1", "127.8.9.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1",
    "0.0.0.0", "0.1.2.3", "224.0.0.1", "255.255.255.255", "::1", "::", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1",
    "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:10.0.0.1", "::ffff:a9fe:a9fe", "64:ff9b::7f00:1", "2002:c0a8:101::1", "not-an-ip",
  ])("blocks %s", (ip) => expect(isBlockedAddress(ip)).toBe(true));
  it.each(["93.184.216.34", "8.8.8.8", "172.32.0.1", "100.128.0.1", "2606:2800:220:1:248:1893:25c8:1946", "::ffff:8.8.8.8"])(
    "allows %s",
    (ip) => expect(isBlockedAddress(ip)).toBe(false),
  );
});

describe("assertPublicUrl", () => {
  const lookup = async (host: string) => ({ "internal.example.com": ["10.0.0.5"], "mixed.example.com": ["93.184.216.34", "192.168.0.10"] })[host] ?? [PUBLIC_IP];
  const reason = async (url: string) => {
    try {
      await assertPublicUrl(url, lookup);
      return "allowed";
    } catch (err) {
      return err instanceof BlockedUrlError ? err.reason : `other:${String(err)}`;
    }
  };
  it("rejects loopback, metadata, private and IPv6 loopback literals", async () => {
    expect(await reason("http://127.0.0.1/")).toBe("private_address");
    expect(await reason("http://169.254.169.254/latest/meta-data/")).toBe("private_address");
    expect(await reason("http://10.0.0.1/")).toBe("private_address");
    expect(await reason("http://[::1]/")).toBe("private_address");
    expect(await reason("http://[::ffff:127.0.0.1]/")).toBe("private_address");
    expect(await reason("http://2130706433/")).toBe("private_address");
    expect(await reason("http://localhost/")).toBe("private_address");
  });
  it("rejects hosts that resolve to a private address, even when only one address is private", async () => {
    expect(await reason("https://internal.example.com/")).toBe("private_address");
    expect(await reason("https://mixed.example.com/")).toBe("private_address");
  });
  it("rejects other schemes, other ports and credentials", async () => {
    expect(await reason("file:///etc/passwd")).toBe("bad_scheme");
    expect(await reason("ftp://example.com/")).toBe("bad_scheme");
    expect(await reason("http://example.com:8080/")).toBe("bad_port");
    expect(await reason("https://user:pass@example.com/")).toBe("credentials_in_url");
  });
  it("allows public http/https on default ports", async () => {
    expect(await reason("https://example.com/")).toBe("allowed");
    expect(await reason("http://example.com:80/x")).toBe("allowed");
    expect(await reason("https://example.com:443/")).toBe("allowed");
  });
});

describe("safeFetch", () => {
  it("follows redirects manually and re-checks every hop", async () => {
    const { deps, calls } = makeDeps({
      routes: { "https://example.com/": redirect("http://192.168.1.1/admin") },
      hosts: {},
    });
    await expect(safeFetch("https://example.com/", deps)).rejects.toMatchObject({ reason: "private_address" });
    expect(calls.map((c) => c.url)).toEqual(["https://example.com/"]);
    expect(calls[0]!.init.redirect).toBe("manual");
    expect(calls[0]!.init.signal).toBeInstanceOf(AbortSignal);
  });
  it("re-checks a hop whose host name resolves to a private address", async () => {
    const { deps } = makeDeps({ routes: { "https://example.com/": redirect("https://intranet.example.com/") }, hosts: { "intranet.example.com": ["10.9.8.7"] } });
    await expect(safeFetch("https://example.com/", deps)).rejects.toBeInstanceOf(BlockedUrlError);
  });
  it("records the redirect chain and allows exactly 5 redirects", async () => {
    const routes: Record<string, Route> = {};
    for (let i = 0; i < 5; i++) routes[`https://example.com/r${i}`] = redirect(`/r${i + 1}`, 302);
    routes["https://example.com/r5"] = htmlResponse("<p>done</p>");
    const { deps } = makeDeps({ routes });
    const res = await safeFetch("https://example.com/r0", deps, { body: "text" });
    expect(res.status).toBe(200);
    expect(res.finalUrl).toBe("https://example.com/r5");
    expect(res.redirectChain).toHaveLength(5);
    expect(res.redirectChain[0]).toMatchObject({ url: "https://example.com/r0", status: 302, location: "https://example.com/r1" });
    expect(res.bodyText).toBe("<p>done</p>");
  });
  it("stops after more than 5 redirects", async () => {
    const routes: Record<string, Route> = {};
    for (let i = 0; i < 7; i++) routes[`https://example.com/r${i}`] = redirect(`/r${i + 1}`);
    const { deps, calls } = makeDeps({ routes });
    await expect(safeFetch("https://example.com/r0", deps)).rejects.toBeInstanceOf(TooManyRedirectsError);
    expect(calls).toHaveLength(6);
  });
  it("caps the body at 2 MB", async () => {
    const big = "a".repeat(3 * 1024 * 1024);
    const { deps } = makeDeps({ routes: { "https://example.com/": () => htmlResponse(big) } });
    const res = await safeFetch("https://example.com/", deps, { body: "text" });
    expect(res.truncated).toBe(true);
    expect(res.bodyText!.length).toBe(2 * 1024 * 1024);
    expect(res.bodyBytes).toBe(2 * 1024 * 1024);
  });
});

// ---------- free checks ----------

describe("runFreeChecks on a page with nothing to report", () => {
  it("returns all seven outcomes in spec order, all clear, all valid", async () => {
    const { deps } = makeDeps(goodWorld());
    const r = await runFreeChecks("https://example.com/", deps);
    expect(r.unreachable).toBe(false);
    expect(r.error).toBeNull();
    expect(r.finalUrl).toBe("https://example.com/");
    expect(r.outcomes.map((o) => o.check.checkId)).toEqual(["page_fetch", "security_headers", "tls_cert", "share_tags", "og_image_fetch", "email_dns", "link_status"]);
    for (const o of r.outcomes) expect({ id: o.check.checkId, state: o.check.state, findings: rules(o) }).toEqual({ id: o.check.checkId, state: "clear", findings: [] });
    expect(r.linksFound).toBe(3);
    expect(r.blockedLinks).toEqual([]);
    expect(byId(r.outcomes, "page_fetch").check.scopeNote).toBe("checked from Vercel iad1");
    expect(byId(r.outcomes, "link_status").check.scopeNote).toBe("checked 3 of 3 links from Vercel iad1");
    expectValid(r.outcomes);
  });
});

describe("share_tags", () => {
  it("flags missing og:image, viewport, og:title, twitter:card, description and a long title", async () => {
    const head = `<title>${"A very long launch title that keeps going ".repeat(2)}</title>`;
    const { deps } = makeDeps(goodWorld({}, { "https://example.com/": htmlResponse(html(GOOD_BODY, head), GOOD_HEADERS) }));
    const r = await runFreeChecks("https://example.com/", deps);
    const share = byId(r.outcomes, "share_tags");
    expect(share.check.state).toBe("problem");
    expect(rules(share).sort()).toEqual(["meta_description_missing", "og_image_missing", "og_title_missing", "title_too_long", "twitter_card_missing", "viewport_missing"]);
    const sev = Object.fromEntries(share.findings.map((f) => [f.ruleId, f.severity]));
    expect(sev).toMatchObject({ og_image_missing: "fix_before_launch", viewport_missing: "fix_before_launch", og_title_missing: "fix_soon", twitter_card_missing: "fix_soon", title_too_long: "fyi", meta_description_missing: "fyi" });
    expect(byId(r.outcomes, "og_image_fetch").check).toMatchObject({ state: "not_checked", notCheckedReason: "not_applicable" });
    expectValid(r.outcomes);
  });
  it("extracts tags with entities, single quotes and attribute order variations", async () => {
    const head = `<TITLE>Tom &amp; Jerry</TITLE><meta content='width=device-width' name='viewport'><meta content="https://cdn.example.com/a.png" property="og:image"><meta property=og:title content=Hi><meta name="twitter:card" content="summary"><meta name="description" content="d">`;
    const { deps } = makeDeps(goodWorld({}, { "https://example.com/": htmlResponse(html(GOOD_BODY, head), GOOD_HEADERS), "https://cdn.example.com/a.png": png() }));
    const r = await runFreeChecks("https://example.com/", deps);
    const share = byId(r.outcomes, "share_tags");
    expect(rules(share)).toEqual([]);
    expect(share.evidence[0]!.fields).toMatchObject({ title: "Tom & Jerry", ogImage: "https://cdn.example.com/a.png", ogTitle: "Hi", lang: "en" });
  });
  it("marks a JS shell page and notes static HTML only", async () => {
    const shell = `<!doctype html><html><head>${GOOD_HEAD}</head><body><div id="root"></div><script>const a = "<a href='/x'>x</a>";</script></body></html>`;
    const { deps } = makeDeps(goodWorld({}, { "https://example.com/": htmlResponse(shell, GOOD_HEADERS) }));
    const r = await runFreeChecks("https://example.com/", deps);
    expect(byId(r.outcomes, "page_fetch").evidence[0]!.fields).toMatchObject({ jsShell: true });
    expect(byId(r.outcomes, "share_tags").check.scopeNote).toMatch(/static HTML only/i);
    expect(r.linksFound).toBe(0);
    expect(byId(r.outcomes, "link_status").check).toMatchObject({ state: "not_checked", notCheckedReason: "not_applicable" });
  });
});

describe("page_fetch", () => {
  it("flags plain HTTP that does not redirect to HTTPS", async () => {
    const { deps } = makeDeps(goodWorld({}, { "http://example.com/": htmlResponse("<p>plain</p>") }));
    const r = await runFreeChecks("https://example.com/", deps);
    const page = byId(r.outcomes, "page_fetch");
    expect(rules(page)).toEqual(["http_not_redirected"]);
    expect(page.check.state).toBe("problem");
    expectValid(r.outcomes);
  });
  it("flags a non-2xx page status and still runs the other checks", async () => {
    const { deps } = makeDeps(goodWorld({}, { "https://example.com/": htmlResponse(html(GOOD_BODY), GOOD_HEADERS, 503) }));
    const r = await runFreeChecks("https://example.com/", deps);
    expect(r.unreachable).toBe(false);
    expect(rules(byId(r.outcomes, "page_fetch"))).toEqual(["page_status_error"]);
    expect(byId(r.outcomes, "page_fetch").findings[0]!.severity).toBe("fix_before_launch");
    expect(r.outcomes).toHaveLength(7);
  });
  it("records the redirect chain from http to https when the user enters http", async () => {
    const { deps } = makeDeps(goodWorld());
    const r = await runFreeChecks("http://example.com/", deps);
    expect(r.finalUrl).toBe("https://example.com/");
    const page = byId(r.outcomes, "page_fetch");
    expect(rules(page)).toEqual([]);
    expect((page.evidence[0]!.fields.redirectChain as unknown[]).length).toBe(1);
  });
});

describe("unreachable page", () => {
  it("stops on DNS failure with no outcomes", async () => {
    const { deps } = makeDeps({ routes: {}, hosts: { "gone.example.com": [] } });
    const r = await runFreeChecks("https://gone.example.com/", deps);
    expect(r).toMatchObject({ unreachable: true, finalUrl: null, outcomes: [], blockedLinks: [], linksFound: 0 });
    expect(r.error).toMatch(/gone\.example\.com/);
    expect(findBannedWords(r.error!)).toEqual([]);
  });
  it("stops on timeout", async () => {
    const { deps } = makeDeps({ routes: { "https://example.com/": () => { throw new DOMException("timed out", "TimeoutError"); } } });
    const r = await runFreeChecks("https://example.com/", deps);
    expect(r.unreachable).toBe(true);
    expect(r.error).toMatch(/8 seconds/);
  });
  it("stops on a blocked address", async () => {
    const { deps, calls } = makeDeps({ routes: {} });
    const r = await runFreeChecks("http://169.254.169.254/", deps);
    expect(r.unreachable).toBe(true);
    expect(calls).toHaveLength(0);
  });
});

describe("security_headers", () => {
  it("flags missing HSTS (fix_soon) and missing CSP/XCTO (fyi) with neutral copy", async () => {
    const { deps } = makeDeps(goodWorld({}, { "https://example.com/": htmlResponse(html(GOOD_BODY), {}) }));
    const r = await runFreeChecks("https://example.com/", deps);
    const sec = byId(r.outcomes, "security_headers");
    expect(Object.fromEntries(sec.findings.map((f) => [f.ruleId, f.severity]))).toEqual({ hsts_missing: "fix_soon", csp_missing: "fyi", xcto_missing: "fyi" });
    expect(sec.findings.find((f) => f.ruleId === "hsts_missing")!.title).toBe("No HSTS header on the homepage response");
    for (const f of sec.findings) expect(`${f.title} ${f.explanation} ${f.fix}`).not.toMatch(/insecure/i);
    expect(sec.evidence[0]!.fields).toMatchObject({ "strict-transport-security": null });
    expectValid(r.outcomes);
  });
  it("records raw header values including frame-ancestors", async () => {
    const { deps } = makeDeps(goodWorld());
    const r = await runFreeChecks("https://example.com/", deps);
    expect(byId(r.outcomes, "security_headers").evidence[0]!.fields).toMatchObject({ "strict-transport-security": "max-age=31536000", frameAncestors: "'none'" });
  });
});

describe("tls_cert", () => {
  it("flags a certificate expiring in 10 days", async () => {
    const { deps } = makeDeps(goodWorld({ cert: { issuer: "Example CA", validFrom: "2026-08-01T00:00:00Z", validTo: "2026-11-16T14:02:00Z", subjectAltNames: ["DNS:example.com"] } }));
    const r = await runFreeChecks("https://example.com/", deps);
    const tls = byId(r.outcomes, "tls_cert");
    expect(rules(tls)).toEqual(["cert_expiring"]);
    expect(tls.findings[0]!.severity).toBe("fix_before_launch");
    expect(tls.evidence[0]!.fields).toMatchObject({ daysLeft: 10, hostMatches: true });
    expectValid(r.outcomes);
  });
  it("flags a host mismatch", async () => {
    const { deps } = makeDeps(goodWorld({ cert: { issuer: "Example CA", validFrom: "2026-08-01T00:00:00Z", validTo: "2027-08-01T00:00:00Z", subjectAltNames: ["DNS:other.example.net", "DNS:*.example.com"] } }));
    const r = await runFreeChecks("https://example.com/", deps);
    expect(rules(byId(r.outcomes, "tls_cert"))).toEqual(["cert_host_mismatch"]);
  });
  it("matches a wildcard for one label", async () => {
    const { deps } = makeDeps(goodWorld({ cert: { issuer: "Example CA", validFrom: "2026-08-01T00:00:00Z", validTo: "2027-08-01T00:00:00Z", subjectAltNames: ["DNS:*.example.com"] } }, {
      "https://www.example.com/": htmlResponse(html(GOOD_BODY), GOOD_HEADERS),
      "http://www.example.com/": redirect("https://www.example.com/"),
      "https://www.example.com/og.png": png(),
      "https://www.example.com/pricing": ok(), "https://www.example.com/docs": ok(), "https://www.example.com/about": ok(),
    }));
    const r = await runFreeChecks("https://www.example.com/", deps);
    expect(rules(byId(r.outcomes, "tls_cert"))).toEqual([]);
  });
  it("is not checked when the handshake fails, keeping the error code", async () => {
    const { deps } = makeDeps(goodWorld({ cert: Object.assign(new Error("handshake"), { code: "ECONNRESET" }) }));
    const r = await runFreeChecks("https://example.com/", deps);
    const tls = byId(r.outcomes, "tls_cert");
    expect(tls.check.state).toBe("not_checked");
    expect(tls.evidence[0]!.fields).toMatchObject({ errorCode: "ECONNRESET" });
    expectValid(r.outcomes);
  });
});

describe("email_dns", () => {
  it("flags missing SPF and DMARC", async () => {
    const { deps } = makeDeps(goodWorld({ txt: { "example.com": [["google-site-verification=abc"]] } }));
    const r = await runFreeChecks("https://example.com/", deps);
    const email = byId(r.outcomes, "email_dns");
    expect(Object.fromEntries(email.findings.map((f) => [f.ruleId, f.severity]))).toEqual({ spf_missing: "fix_soon", dmarc_missing: "fix_soon" });
    expect(email.findings.find((f) => f.ruleId === "dmarc_missing")!.explanation).toBe("We found no DMARC record. Signup and waitlist emails from this domain are more likely to land in spam.");
    expectValid(r.outcomes);
  });
  it("flags p=none as fyi and quotes the record", async () => {
    const { deps } = makeDeps(goodWorld({ txt: { "example.com": [["v=spf1 -all"]], "_dmarc.example.com": [["v=DMARC1; ", "p=none"]] } }));
    const r = await runFreeChecks("https://example.com/", deps);
    const email = byId(r.outcomes, "email_dns");
    expect(rules(email)).toEqual(["dmarc_p_none"]);
    expect(email.findings[0]!.severity).toBe("fyi");
    expect(email.findings[0]!.observed).toContain("v=DMARC1; p=none");
    expect(email.evidence[0]!.fields).toMatchObject({ spf: "v=spf1 -all", dmarc: "v=DMARC1; p=none", dmarcPolicy: "none" });
  });
  it("uses the apex without www", async () => {
    const { deps } = makeDeps(goodWorld({}, {
      "https://www.example.com/": htmlResponse(html(GOOD_BODY), GOOD_HEADERS),
      "http://www.example.com/": redirect("https://www.example.com/"),
      "https://www.example.com/og.png": png(),
      "https://www.example.com/pricing": ok(), "https://www.example.com/docs": ok(), "https://www.example.com/about": ok(),
    }));
    const r = await runFreeChecks("https://www.example.com/", deps);
    expect(rules(byId(r.outcomes, "email_dns"))).toEqual([]);
  });
  it("is not checked on SERVFAIL", async () => {
    const { deps } = makeDeps(goodWorld({ txt: { "example.com": Object.assign(new Error("queryTxt ESERVFAIL example.com"), { code: "ESERVFAIL" }) } }));
    const r = await runFreeChecks("https://example.com/", deps);
    const email = byId(r.outcomes, "email_dns");
    expect(email.check.state).toBe("not_checked");
    expect(email.findings).toEqual([]);
    expectValid(r.outcomes);
  });
});

describe("og_image_fetch", () => {
  it("flags an og:image that returns 404", async () => {
    const { deps } = makeDeps(goodWorld({}, { "https://example.com/og.png": new Response("nope", { status: 404, headers: { "content-type": "text/html" } }) }));
    const r = await runFreeChecks("https://example.com/", deps);
    const og = byId(r.outcomes, "og_image_fetch");
    expect(rules(og)).toEqual(["og_image_broken"]);
    expect(og.findings[0]!.severity).toBe("fix_before_launch");
    expect(og.findings[0]!.observed).toContain("404");
    expectValid(r.outcomes);
  });
  it("flags an og:image that is not an image", async () => {
    const { deps } = makeDeps(goodWorld({}, { "https://example.com/og.png": htmlResponse("<html></html>") }));
    const r = await runFreeChecks("https://example.com/", deps);
    expect(rules(byId(r.outcomes, "og_image_fetch"))).toEqual(["og_image_broken"]);
  });
});

describe("link_status", () => {
  const body = `
    <header><a href="/">Home</a><a href="/signup">Sign up</a></header>
    <main><a href="/blog">Blog</a><a href="https://elsewhere.example.org/">Partner</a><a href="/get">Get started</a>
    <a href="/old">Old</a><a href="/slow">Slow</a><a href="/loop0">Loop</a><a href="/head-no">Head</a><a href="/blog#x">Blog again</a></main>`;
  const routes = (): Record<string, Route> => {
    const r: Record<string, Route> = {
      "https://example.com/": htmlResponse(html(body), GOOD_HEADERS),
      "https://example.com/signup": ok(),
      "https://example.com/blog": new Response(null, { status: 404 }),
      "https://example.com/get": new Response(null, { status: 403 }),
      "https://example.com/old": new Response(null, { status: 500 }),
      "https://example.com/slow": () => { throw new DOMException("timed out", "TimeoutError"); },
      "https://example.com/head-no": (init) =>
        init.method === "HEAD" ? new Response(null, { status: 405 }) : new Response("x", { status: 206, headers: { "content-range": "bytes 0-0/10" } }),
    };
    for (let i = 0; i < 7; i++) r[`https://example.com/loop${i}`] = redirect(`/loop${i + 1}`);
    return r;
  };

  it("reports broken links, a redirect loop, blocked links and uses GET after HEAD 405", async () => {
    const { deps, calls } = makeDeps(goodWorld({}, routes()));
    const r = await runFreeChecks("https://example.com/", deps);
    const links = byId(r.outcomes, "link_status");
    expect(links.check.state).toBe("problem");
    expect(rules(links).sort()).toEqual(["link_broken", "link_broken", "link_redirect_loop"]);
    expect(links.findings.filter((f) => f.ruleId === "link_broken").map((f) => f.id).sort()).toEqual(["f_link_broken_1", "f_link_broken_2"]);
    expect(links.findings.every((f) => f.severity === "fix_before_launch")).toBe(true);
    expect(r.blockedLinks.sort()).toEqual(["https://example.com/get", "https://example.com/slow"]);
    const headNo = calls.filter((c) => c.url === "https://example.com/head-no");
    expect(headNo.map((c) => c.init.method)).toEqual(["HEAD", "GET"]);
    expect(new Headers(headNo[1]!.init.headers).get("range")).toBe("bytes=0-0");
    // external non-CTA link and the page itself are not checked; the duplicate #x link is merged
    expect(calls.some((c) => c.url.startsWith("https://elsewhere.example.org"))).toBe(false);
    expect(calls.filter((c) => c.url === "https://example.com/blog")).toHaveLength(1);
    expect(r.linksFound).toBe(9);
    expectValid(r.outcomes);
  });

  it("checks at most 10 links, navigation and CTA links first", async () => {
    const many = Array.from({ length: 15 }, (_, i) => `<a href="/p${i}">Page ${i}</a>`).join("") + `<a href="/contact">Contact</a><nav><a href="/n1">N</a></nav>`;
    const extra: Record<string, Route> = { "https://example.com/": htmlResponse(html(many), GOOD_HEADERS), "https://example.com/contact": ok(), "https://example.com/n1": ok() };
    for (let i = 0; i < 15; i++) extra[`https://example.com/p${i}`] = ok();
    const { deps, calls } = makeDeps(goodWorld({}, extra));
    const r = await runFreeChecks("https://example.com/", deps);
    const links = byId(r.outcomes, "link_status");
    const checked = (links.evidence[0]!.fields.links as { url: string }[]).map((l) => l.url);
    expect(checked).toHaveLength(10);
    expect(checked.slice(0, 2).sort()).toEqual(["https://example.com/contact", "https://example.com/n1"]);
    expect(links.check.scopeNote).toBe("checked 10 of 17 links from Vercel iad1");
    expect(calls.some((c) => c.url === "https://example.com/p14")).toBe(false);
  });

  it("does not follow a link that points to a private address", async () => {
    const body2 = `<nav><a href="http://10.0.0.1/admin">Admin</a><a href="/a">A</a><a href="/b">B</a></nav>`;
    const { deps, calls } = makeDeps(goodWorld({}, { "https://example.com/": htmlResponse(html(body2), GOOD_HEADERS), "https://example.com/a": ok(), "https://example.com/b": ok() }));
    const r = await runFreeChecks("https://example.com/", deps);
    expect(calls.some((c) => c.url.includes("10.0.0.1"))).toBe(false);
    expect(rules(byId(r.outcomes, "link_status"))).toEqual([]);
    expect(r.blockedLinks).toEqual([]);
  });
});
