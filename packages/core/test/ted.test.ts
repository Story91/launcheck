import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NoticeNotFoundError, fetchNoticeXml, isValidNoticeId, searchNotices } from "../src/ted/client";
import { flattenEforms } from "../src/ted/flatten";
import tedSearch from "./fixtures/ted-search.json";

const xml = readFileSync(new URL("./fixtures/722731-2026.xml", import.meta.url), "utf8");

const jsonResponse = (body: unknown, status = 200) =>
  (async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;

describe("flattenEforms", () => {
  const flat = flattenEforms(xml);

  it("detects the notice language", () => {
    expect(flat.language).toBe("POL");
  });

  it("keeps substantive Polish text", () => {
    expect(flat.text).toContain("integracją z Systemem DarkTrace");
    expect(flat.text).toContain("Cena brutto oferty");
  });

  it("extracts the buyer platform", () => {
    expect(flat.buyerPlatform).toBe("https://e-zamowienia.nbp.pl/");
  });

  it("drops identifier noise", () => {
    expect(flat.text.split("\n").some((l) => l.startsWith("UUID:"))).toBe(false);
  });
});

describe("isValidNoticeId", () => {
  it("accepts TED publication numbers", () => expect(isValidNoticeId("722731-2026")).toBe(true));
  it("rejects garbage", () => expect(isValidNoticeId("abc")).toBe(false));
});

describe("fetchNoticeXml", () => {
  it("throws NoticeNotFoundError on 404", async () => {
    const fetch404 = (async () => new Response("not found", { status: 404 })) as unknown as typeof fetch;
    await expect(fetchNoticeXml("999999-2026", fetch404)).rejects.toBeInstanceOf(NoticeNotFoundError);
  });

  it("throws NoticeNotFoundError when the body is not a notice", async () => {
    const fetchHtml = (async () => new Response("<html>error</html>", { status: 200 })) as unknown as typeof fetch;
    await expect(fetchNoticeXml("999999-2026", fetchHtml)).rejects.toBeInstanceOf(NoticeNotFoundError);
  });
});

describe("searchNotices", () => {
  it("maps the TED search response to summaries", async () => {
    const result = await searchNotices("place-of-performance=POL", { fetchImpl: jsonResponse(tedSearch) });
    expect(result).toHaveLength(3);
    expect(result[0]?.noticeId).toMatch(/^\d+-\d{4}$/);
    expect(typeof result[0]?.buyer).toBe("string");
    expect(typeof result[0]?.title).toBe("string");
  });
});

describe("TED API ingest", () => {
  it("flattens an API notice into field: text lines in the notice language", async () => {
    const { flattenApiNotice } = await import("../src/ted/api");
    const api = (await import("./fixtures/722731-2026.api.json")).default as { notices: Record<string, unknown>[] };
    const flat = flattenApiNotice(api.notices[0]!);
    expect(flat.language).toBe("POL");
    expect(flat.text).toContain("integracją z Systemem DarkTrace");
    expect(flat.text).toContain("Cena brutto oferty");
    expect(flat.text).toContain("Wadium w wysokości 63 000,00 PLN");
    expect(flat.text).not.toContain("Lengyelország");
    expect(flat.buyerPlatform).toBe("https://e-zamowienia.nbp.pl");
  });

  it("fetches a notice through the API and fails with NoticeNotFoundError when the API returns nothing", async () => {
    const { fetchNoticeViaApi } = await import("../src/ted/api");
    const api = (await import("./fixtures/722731-2026.api.json")).default;
    const calls: string[] = [];
    const ok = (async (url: string, init: RequestInit) => {
      calls.push(JSON.parse(String(init.body)).query);
      return new Response(JSON.stringify(api), { status: 200, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;
    const notice = await fetchNoticeViaApi("722731-2026", ok);
    expect(notice["publication-number"]).toBe("722731-2026");
    expect(calls[0]).toBe("publication-number=722731-2026");
    const empty = (async () => new Response(JSON.stringify({ notices: [] }), { status: 200 })) as unknown as typeof fetch;
    await expect(fetchNoticeViaApi("999999-2026", empty)).rejects.toBeInstanceOf(NoticeNotFoundError);
  });
});
