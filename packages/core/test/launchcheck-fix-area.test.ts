import { describe, expect, it } from "vitest";
import { launchCheckFixArea, launchCheckSharedHostingSuffix } from "../src/launchcheck/fix-area";

describe("launchCheckFixArea", () => {
  it("places page tag findings in the page", () => {
    for (const rule of ["og_image_missing", "viewport_missing", "meta_description_missing", "link_broken", "og_image_broken"]) expect(launchCheckFixArea(rule)).toBe("page");
  });
  it("places response header findings in server settings", () => {
    for (const rule of ["csp_missing", "xcto_missing", "hsts_missing", "http_not_redirected"]) expect(launchCheckFixArea(rule)).toBe("server");
  });
  it("places mail record findings in DNS and certificate findings at the certificate", () => {
    expect(launchCheckFixArea("spf_missing")).toBe("dns");
    expect(launchCheckFixArea("dmarc_p_none")).toBe("dns");
    expect(launchCheckFixArea("cert_expiring")).toBe("certificate");
  });
  it("falls back to the page for rules it does not know", () => {
    expect(launchCheckFixArea("something_new")).toBe("page");
  });
});

describe("launchCheckSharedHostingSuffix", () => {
  it("recognises subdomains of hosting platforms", () => {
    expect(launchCheckSharedHostingSuffix("tendr-ecru.vercel.app")).toBe("vercel.app");
    expect(launchCheckSharedHostingSuffix("My-Site.GitHub.io.")).toBe("github.io");
    expect(launchCheckSharedHostingSuffix("a.b.pages.dev")).toBe("pages.dev");
  });
  it("leaves own domains and the platform apex alone", () => {
    expect(launchCheckSharedHostingSuffix("www.launcheck.xyz")).toBeNull();
    expect(launchCheckSharedHostingSuffix("vercel.app")).toBeNull();
    expect(launchCheckSharedHostingSuffix("notvercel.app")).toBeNull();
  });
});
