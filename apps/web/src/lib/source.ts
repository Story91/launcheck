import { isSamNoticeId } from "@tendr/core/ted/client";

export interface NoticeSource {
  label: "SAM.gov" | "TED";
  jurisdiction: "US" | "EU";
  /** Public page of the original notice. */
  url: string;
}

/** Where a notice comes from, derived from its id format; SAM.gov uses the notice's own uiLink when known. */
export function noticeSource(noticeId: string, buyerPlatform: string | null): NoticeSource {
  if (isSamNoticeId(noticeId)) {
    const url = buyerPlatform?.startsWith("https://sam.gov/") ? buyerPlatform : `https://sam.gov/opp/${noticeId}/view`;
    return { label: "SAM.gov", jurisdiction: "US", url };
  }
  return { label: "TED", jurisdiction: "EU", url: `https://ted.europa.eu/en/notice/-/detail/${noticeId}` };
}

/** Rules were tuned on Polish TED notices; other EU languages get a reduced-confidence note. US notices are English. */
export function showsLanguageWarning(noticeId: string, language: string | null): boolean {
  return !isSamNoticeId(noticeId) && !!language && language !== "POL";
}
