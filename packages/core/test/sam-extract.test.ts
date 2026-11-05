import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCsv, readSamExtract, redactContacts, SAM_EXTRACT_URL } from "../src/sam/extract";

const bytes = readFileSync(new URL("./fixtures/sam-extract.csv", import.meta.url));
const NOW = () => new Date("2026-11-05T12:00:00Z");

/** Serves the fixture in small chunks so multi-byte and quoted-newline boundaries cross chunk edges. */
const extractFetch = (async () =>
  new Response(
    new ReadableStream({
      start(c) {
        for (let i = 0; i < bytes.length; i += 97) c.enqueue(bytes.subarray(i, i + 97));
        c.close();
      },
    }),
    { status: 200 },
  )) as unknown as typeof fetch;

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const x of it) out.push(x);
  return out;
}

describe("parseCsv", () => {
  it("handles quoted commas, escaped quotes and newlines across chunk boundaries", async () => {
    async function* chunks() {
      yield 'a,"b,1","say ""hi"""\n"multi\nli';
      yield 'ne",x,y\r\n';
    }
    expect(await collect(parseCsv(chunks()))).toEqual([
      ["a", "b,1", 'say "hi"'],
      ["multi\nline", "x", "y"],
    ]);
  });
});

describe("redactContacts", () => {
  it("removes email addresses and US phone numbers", () => {
    expect(redactContacts("Email jane.doe@navy.mil or call (360) 555-0142 / 360-555-0142.")).toBe("Email [email removed] or call [phone removed] / [phone removed].");
  });
});

describe("readSamExtract", () => {
  it("keeps recent active solicitations with a real description, decoded from Windows-1252", async () => {
    const notices = await collect(readSamExtract({ fetchImpl: extractFetch, now: NOW, days: 30 }));
    expect(notices.map((n) => n.noticeId)).toEqual(["3aeff044414241b595f6a5752d18e242", "f014449725d44414a1357303ec0ecb4f"]);
    const hid = notices[0]!;
    expect(hid.title).toBe("HID ID/Access Cards");
    expect(hid.link).toBe("https://sam.gov/opp/3aeff044414241b595f6a5752d18e242/view");
    expect(hid.postedAt).toBe("2026-11-04T20:47:24Z");
    expect(hid.flat.language).toBe("ENG");
    expect(hid.flat.text).toContain("title: HID ID/Access Cards");
    expect(hid.flat.text).toContain("description: ** THIS IS A BRAND NAME REQUIREMENT **");
    expect(hid.flat.text).not.toMatch(/Primary|Secondary|Contact/);
    expect(notices[1]!.flat.text).toContain("[email removed]");
    expect(notices[1]!.flat.text).not.toContain("@");
  });

  it("drops notices posted before the window", async () => {
    const later = () => new Date("2027-01-10T00:00:00Z");
    expect(await collect(readSamExtract({ fetchImpl: extractFetch, now: later, days: 30 }))).toEqual([]);
  });

  it("points at the public daily extract", () => {
    expect(SAM_EXTRACT_URL).toMatch(/^https:\/\/sam\.gov\/api\/prod\/fileextractservices\/.+ContractOpportunitiesFullCSV\.csv\?privacy=Public$/);
  });

  it("throws on a non-2xx download", async () => {
    const bad = (async () => new Response("no", { status: 503 })) as unknown as typeof fetch;
    await expect(collect(readSamExtract({ fetchImpl: bad, now: NOW }))).rejects.toThrow(/HTTP 503/);
  });
});
