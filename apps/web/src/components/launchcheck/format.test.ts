import { describe, expect, it } from "vitest";
import { escapeXml, explorerUrl, imageSource, isActive, normalizeTarget, usd } from "./format";
describe("public check inputs and output links", () => {
  it("normalizes a public hostname and removes fragments", () => { expect(normalizeTarget(" example.com/a#pricing ")).toBe("https://example.com/a"); });
  it.each(["javascript:alert(1)", "https://user:secret@example.com", "localhost", "http://127.0.0.1", "http://[::1]", "http://example.com:8080", "https://example.com?token=secret", "http://2130706433", "https://demo.local"])("rejects unsafe or private input %s", input => { expect(() => normalizeTarget(input)).toThrow(); });
  it("preserves thousandths of a dollar", () => { expect(usd(.005)).toBe("$0.005"); expect(usd(.107)).toBe("$0.107"); expect(usd(.15)).toBe("$0.15"); });
  it("allows only actual Base transaction links", () => { expect(explorerUrl(`https://basescan.org/tx/0x${"a".repeat(64)}`)).toBeTruthy(); expect(explorerUrl("https://basescan.org.evil.test/tx/x")).toBeNull(); expect(explorerUrl("javascript:alert(1)")).toBeNull(); });
  it("rejects executable and protocol-relative image sources", () => { expect(imageSource("data:image/svg+xml,<svg/>")).toBeUndefined(); expect(imageSource("//evil.test/x")).toBeUndefined(); expect(imageSource("javascript:alert(1)")).toBeUndefined(); expect(imageSource("/images/demo.png")).toBe("/images/demo.png"); });
  it("stops polling at every terminal status", () => { for (const state of ["done", "failed", "unreachable"]) expect(isActive(state)).toBe(false); expect(isActive("buying")).toBe(true); });
  it("escapes report data inside badges", () => { expect(escapeXml('<script a="x">&')).toBe("&lt;script a=&quot;x&quot;&gt;&amp;"); });
});
