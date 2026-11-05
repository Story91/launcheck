import { describe, expect, it } from "vitest";
import { noticeSource, showsLanguageWarning } from "@/lib/source";

const SAM = "3f2a9c41d7e84b6a9b1c0d2e5f6a7b8c";

describe("noticeSource", () => {
  it("labels SAM.gov notices and links to the SAM.gov page", () => {
    expect(noticeSource(SAM, `https://sam.gov/opp/${SAM}/view`)).toEqual({ label: "SAM.gov", jurisdiction: "US", url: `https://sam.gov/opp/${SAM}/view` });
    expect(noticeSource(SAM, null).url).toBe(`https://sam.gov/opp/${SAM}/view`);
  });

  it("labels TED notices and links to the TED page", () => {
    expect(noticeSource("722731-2026", "https://e-zamowienia.nbp.pl")).toEqual({ label: "TED", jurisdiction: "EU", url: "https://ted.europa.eu/en/notice/-/detail/722731-2026" });
  });
});

describe("showsLanguageWarning", () => {
  it("warns only for TED notices outside Polish", () => {
    expect(showsLanguageWarning("722731-2026", "POL")).toBe(false);
    expect(showsLanguageWarning("722731-2026", "DEU")).toBe(true);
    expect(showsLanguageWarning(SAM, "ENG")).toBe(false);
    expect(showsLanguageWarning("722731-2026", null)).toBe(false);
  });
});
