import { describe, expect, it } from "vitest";
import { filterItems, type MarketItem } from "./tender-market";

const now = Date.parse("2026-11-05T00:00:00Z");
const item = (id: string, score: number | null, deadline: string | null): MarketItem => ({
  noticeId: id,
  title: id,
  buyer: "b",
  deadline,
  analysis: score === null ? null : { riskScore: score, signals: [] },
});
const items = [item("a", 72, "2026-11-20"), item("b", 10, "2026-11-08"), item("c", null, "2026-11-07"), item("d", null, "2026-10-01")];

describe("filterItems", () => {
  it("filters analyzed, high risk and closing soon", () => {
    expect(filterItems(items, "All", now)).toHaveLength(4);
    expect(filterItems(items, "Analyzed", now).map((i) => i.noticeId)).toEqual(["a", "b"]);
    expect(filterItems(items, "High risk", now).map((i) => i.noticeId)).toEqual(["a"]);
    expect(filterItems(items, "Closing soon", now).map((i) => i.noticeId)).toEqual(["b", "c"]);
  });
});
