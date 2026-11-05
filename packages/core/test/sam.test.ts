import { describe, expect, it } from "vitest";
import { NoticeNotFoundError, isSamNoticeId, isTedNoticeId, isValidNoticeId } from "../src/ted/client";
import { fetchSamNotice, flattenSamOpportunity, htmlToText, searchSamOpportunities, SamConfigError } from "../src/sam/client";
import search from "./fixtures/sam-search.json";
import description from "./fixtures/sam-description.json";

const NOTICE = "3f2a9c41d7e84b6a9b1c0d2e5f6a7b8c";
const opp = search.opportunitiesData[0]!;

function samFetch(opts: { searchBody?: unknown; descBody?: unknown; status?: number } = {}) {
  const calls: string[] = [];
  const fetchImpl = (async (url: string) => {
    calls.push(url);
    if (opts.status) return new Response("", { status: opts.status });
    const body = url.includes("/noticedesc") ? (opts.descBody ?? description) : (opts.searchBody ?? search);
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe("notice id formats", () => {
  it("recognises SAM.gov and TED ids", () => {
    expect(isSamNoticeId(NOTICE)).toBe(true);
    expect(isSamNoticeId("722731-2026")).toBe(false);
    expect(isTedNoticeId("722731-2026")).toBe(true);
    expect(isValidNoticeId(NOTICE)).toBe(true);
    expect(isValidNoticeId("722731-2026")).toBe(true);
    expect(isValidNoticeId("abc")).toBe(false);
  });
});

describe("htmlToText", () => {
  it("strips tags, decodes entities and keeps paragraph breaks", () => {
    expect(htmlToText("<p>A &amp; B</p><p>C&nbsp;<b>D</b></p>")).toBe("A & B\nC D");
  });
});

describe("flattenSamOpportunity", () => {
  it("produces field: text lines in English with the description inline and the SAM.gov link", () => {
    const flat = flattenSamOpportunity(opp, htmlToText(description.description));
    expect(flat.language).toBe("ENG");
    expect(flat.buyerPlatform).toBe(`https://sam.gov/opp/${NOTICE}/view`);
    expect(flat.text).toContain("title: Splunk Enterprise Security Licenses and Support - Brand Name Only");
    expect(flat.text).toContain("responseDeadLine: 2026-11-06T12:00:00-05:00");
    expect(flat.text).toContain("on a brand name only basis");
    expect(flat.text).toContain("No other product will be considered.");
    expect(flat.text).not.toContain("<p>");
  });
});

describe("fetchSamNotice", () => {
  it("requires an API key", async () => {
    await expect(fetchSamNotice(NOTICE, { apiKey: "" })).rejects.toBeInstanceOf(SamConfigError);
  });

  it("searches by noticeid with the key, then fetches the description with the key", async () => {
    const { fetchImpl, calls } = samFetch();
    const flat = await fetchSamNotice(NOTICE, { apiKey: "k", fetchImpl, now: () => new Date("2026-11-05T00:00:00Z") });
    expect(calls[0]).toContain("https://api.sam.gov/opportunities/v2/search?");
    expect(calls[0]).toContain(`noticeid=${NOTICE}`);
    expect(calls[0]).toContain("api_key=k");
    expect(calls[0]).toContain("postedFrom=11%2F06%2F2025");
    expect(calls[0]).toContain("postedTo=11%2F05%2F2026");
    expect(calls[1]).toContain(`/noticedesc?noticeid=${NOTICE}`);
    expect(calls[1]).toContain("api_key=k");
    expect(flat.text).toContain("three prior contracts with the Department of Veterans Affairs");
  });

  it("throws NoticeNotFoundError when the search returns nothing", async () => {
    const { fetchImpl } = samFetch({ searchBody: { totalRecords: 0, opportunitiesData: [] } });
    await expect(fetchSamNotice(NOTICE, { apiKey: "k", fetchImpl })).rejects.toBeInstanceOf(NoticeNotFoundError);
  });

  it("keeps going with metadata only when the description is unavailable", async () => {
    const { fetchImpl } = samFetch({ descBody: { description: "Description Not Found" } });
    const flat = await fetchSamNotice(NOTICE, { apiKey: "k", fetchImpl });
    expect(flat.text).toContain("title: Splunk Enterprise Security");
    expect(flat.text).not.toContain("Description Not Found");
  });

  it("reports an invalid key clearly (the gateway answers 404 or 403 with an empty body)", async () => {
    const { fetchImpl } = samFetch({ status: 404 });
    await expect(fetchSamNotice(NOTICE, { apiKey: "bad", fetchImpl })).rejects.toThrow(/SAM\.gov API rejected the request \(HTTP 404\)/);
  });
});

describe("searchSamOpportunities", () => {
  it("lists recent solicitations as notice summaries", async () => {
    const { fetchImpl, calls } = samFetch();
    const list = await searchSamOpportunities({ apiKey: "k", fetchImpl, naics: ["541512"], now: () => new Date("2026-11-05T00:00:00Z") });
    expect(list).toEqual([
      { noticeId: NOTICE, title: opp.title, buyer: "TECHNOLOGY ACQUISITION CENTER NJ (36C10B)", deadline: "2026-11-06T12:00:00-05:00" },
    ]);
    expect(calls[0]).toContain("ncode=541512");
    expect(calls[0]).toContain("ptype=o%2Ck");
    expect(calls[0]).toContain("postedFrom=10%2F06%2F2026");
  });
});
