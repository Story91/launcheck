import { normalizeTarget, escapeXml } from "./format";
export type PreviewFields = { title: string; description: string; url: string; image: string };
export function previewCode(fields: PreviewFields, kind: "html" | "next") {
  if (!fields.title.trim() || !fields.description.trim() || fields.title.length > 200 || fields.description.length > 500) return null;
  let url: string, image: string;
  try { url = normalizeTarget(fields.url); image = normalizeTarget(fields.image); } catch { return null; }
  const title = fields.title.trim(), description = fields.description.trim();
  if (kind === "next") {
    const metadata = { title, description, openGraph: { type: "website", url, title, description, images: [{ url: image }] }, twitter: { card: "summary_large_image", title, description, images: [image] } };
    // JS string literals stay data even for malicious pasted text or line separators.
    return `export const metadata = ${JSON.stringify(metadata, null, 2).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029")};\n`;
  }
  return [
    `<title>${escapeXml(title)}</title>`,
    `<meta name="description" content="${escapeXml(description)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:url" content="${escapeXml(url)}" />`,
    `<meta property="og:title" content="${escapeXml(title)}" />`,
    `<meta property="og:description" content="${escapeXml(description)}" />`,
    `<meta property="og:image" content="${escapeXml(image)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeXml(title)}" />`,
    `<meta name="twitter:description" content="${escapeXml(description)}" />`,
    `<meta name="twitter:image" content="${escapeXml(image)}" />`,
  ].join("\n");
}
