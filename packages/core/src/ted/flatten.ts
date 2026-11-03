const SKIP_TAGS =
  /^(ID|UUID|SubTypeCode|ListName|Code|IssueDate|IssueTime|VersionID|CustomizationID|EndpointID|IdentificationCode)$/;

export interface FlatNotice {
  text: string;
  language: string;
  buyerPlatform: string | null;
}

/** Main language = first languageID on a Name inside ProcurementProject; falls back to the first languageID seen. */
function detectLanguage(xml: string): string {
  const project = /<cac:ProcurementProject>[\s\S]*?<cbc:Name[^>]*languageID="([A-Z]{3})"/.exec(xml);
  if (project?.[1]) return project[1];
  return /languageID="([A-Z]{3})"/.exec(xml)?.[1] ?? "ENG";
}

/** Flattens an eForms UBL notice into "Tag: text" lines in the notice language (+ENG). */
export function flattenEforms(xml: string): FlatNotice {
  const language = detectLanguage(xml);
  const lines: string[] = [];
  const re = /<(?:[a-zA-Z]+:)?([A-Za-z]+)([^>]*)>([^<]+)<\//g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const tag = m[1] ?? "";
    const attrs = m[2] ?? "";
    const txt = (m[3] ?? "").replace(/\s+/g, " ").trim();
    if (txt.length < 3 || SKIP_TAGS.test(tag)) continue;
    const lang = /languageID="([A-Z]{3})"/.exec(attrs)?.[1];
    if (lang && lang !== language && lang !== "ENG") continue;
    const line = `${tag}: ${txt}`;
    if (line !== lines[lines.length - 1]) lines.push(line);
  }
  const buyerPlatform = /<cbc:EndpointID>([^<]+)</.exec(xml)?.[1]?.trim() ?? null;
  return { text: lines.join("\n"), language, buyerPlatform };
}
