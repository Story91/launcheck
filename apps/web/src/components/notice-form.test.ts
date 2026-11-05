import { describe, expect, it } from "vitest";
import { extractNoticeId } from "./notice-form";

describe("extractNoticeId", () => {
  it("pulls the id out of a pasted TED URL", () => {
    expect(extractNoticeId("https://ted.europa.eu/en/notice/-/detail/722731-2026")).toBe("722731-2026");
  });
  it("keeps a bare id and trims text around it", () => {
    expect(extractNoticeId("  Notice 722731-2026 ")).toBe("722731-2026");
  });
  it("returns trimmed input when nothing matches", () => {
    expect(extractNoticeId(" abc ")).toBe("abc");
  });
});
