import type { ImportedSamNotice } from "@tendr/core";
import { describe, expect, it } from "vitest";
import { importSamNotices, MemorySamNoticeStore } from "@/lib/sam-notices";

const NOW = new Date("2026-11-05T12:00:00Z");
const n = (id: string, over: Partial<ImportedSamNotice> = {}): ImportedSamNotice => ({
  noticeId: id.padEnd(32, "0"),
  title: `Notice ${id}`,
  solicitationNumber: null,
  agency: "DEPT OF DEFENSE.DEPT OF THE NAVY.FLC PUGET SOUND",
  postedAt: "2026-11-04T10:00:00Z",
  responseDeadline: "2026-11-20T17:00:00-05:00",
  naics: "541512",
  setAside: null,
  link: `https://sam.gov/opp/${id.padEnd(32, "0")}/view`,
  flat: { text: `title: Notice ${id}`, language: "ENG", buyerPlatform: null },
  ...over,
});

async function* from(items: ImportedSamNotice[]) {
  yield* items;
}

describe("importSamNotices", () => {
  it("upserts in batches, prunes old notices and reports counts", async () => {
    const store = new MemorySamNoticeStore();
    await store.upsertMany([n("old", { postedAt: "2026-09-01T00:00:00Z" })]);
    const result = await importSamNotices(store, from([n("a1"), n("a2"), n("a3")]), { now: NOW, keepDays: 45, batchSize: 2 });
    expect(result).toEqual({ imported: 3, pruned: 1, total: 3 });
    expect((await store.get("a1".padEnd(32, "0")))?.text).toBe("title: Notice a1");
    expect(await store.get("old".padEnd(32, "0"))).toBeNull();
  });
});

describe("MemorySamNoticeStore.listOpen", () => {
  it("lists open notices for the NAICS prefixes, newest first, with the agency's last segment as buyer", async () => {
    const store = new MemorySamNoticeStore();
    await store.upsertMany([
      n("b1", { postedAt: "2026-11-01T00:00:00Z" }),
      n("b2", { postedAt: "2026-11-03T00:00:00Z" }),
      n("closed", { responseDeadline: "2026-11-01T00:00:00Z" }),
      n("food", { naics: "311211" }),
      n("nodl", { responseDeadline: null, postedAt: "2026-11-02T00:00:00Z" }),
    ]);
    const list = await store.listOpen({ naicsPrefixes: ["5415", "5182"], limit: 10, now: NOW });
    expect(list.map((x) => x.noticeId.replace(/0+$/, ""))).toEqual(["b2", "nodl", "b1"]);
    expect(list[0]).toMatchObject({ title: "Notice b2", buyer: "FLC PUGET SOUND", deadline: "2026-11-20T17:00:00-05:00" });
  });
});
