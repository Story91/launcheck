import { describe, expect, it } from "vitest";
import { previewCode } from "./link-preview-code";
const fields = { title: "Orbit", description: "A place for ideas.", url: "https://example.com/product", image: "https://example.com/cover.png" };
describe("link preview code", () => {
  it("emits a complete preview without inventing image dimensions", () => {
    const code = previewCode(fields, "html")!;
    expect(code).toContain('property="og:image" content="https://example.com/cover.png"');
    expect(code).toContain('name="twitter:card" content="summary_large_image"');
    expect(code).not.toContain("width");
  });
  it("escapes pasted markup rather than making executable HTML", () => {
    const code = previewCode({ ...fields, title: '</title><script>alert("x")</script>', description: '" onload="alert(1)' }, "html")!;
    expect(code).not.toContain("<script>");
    expect(code).toContain("&lt;script&gt;");
    expect(code).toContain("&quot; onload=&quot;");
  });
  it("keeps a Next.js export parseable with hostile strings", () => {
    const title = '</script>`${process.env.SECRET}`\u2028';
    const code = previewCode({ ...fields, title }, "next")!;
    const data = JSON.parse(code.replace("export const metadata = ", "").trim().slice(0, -1));
    expect(data.title).toBe(title.trim());
    expect(data.openGraph.url).toBe(fields.url);
    expect(code).not.toContain("</script>");
  });
  it.each(["javascript:alert(1)", "http://localhost", "https://127.0.0.1", "https://user:pass@example.com", "https://example.com?token=secret", ""])("rejects unsuitable addresses: %s", url => {
    expect(previewCode({ ...fields, url }, "html")).toBeNull();
    expect(previewCode({ ...fields, image: url }, "next")).toBeNull();
  });
  it("does not generate incomplete tags", () => { expect(previewCode({ ...fields, title: " " }, "html")).toBeNull(); });
});
