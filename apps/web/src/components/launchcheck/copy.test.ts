import { describe, expect, it } from "vitest";
import { copy, reportHeadline, shareText } from "./copy";
import { BANNED_WORDS } from "@tendr/core";
function strings(value: unknown): string[] { if (typeof value === "string") return [value]; if (value && typeof value === "object") return Object.values(value).flatMap(strings); return []; }
describe("LaunchCheck public claims", () => {
  it("does not turn limited observations into a quality verdict", () => { const all = [...strings(copy), reportHeadline(11, 0, 1), shareText({ budgetUsd: .15, spentUsd: .1, problems: 0, paidCalls: 4 }), shareText({ budgetUsd: .15, spentUsd: .01, problems: 0, paidCalls: 2, fixed: 2, original: 3 })].join(" ").replace(/security headers/gi, ""); for (const word of BANNED_WORDS) expect(all, word).not.toMatch(new RegExp(`\\b${word}\\b`, "i")); });
  it("labels fixture social posts", () => { expect(shareText({ budgetUsd: .15, spentUsd: .1, problems: 2, paidCalls: 4, fixture: true })).toContain("example"); });
  it("keeps incomplete fixes explicit", () => { expect(shareText({ budgetUsd: .15, spentUsd: .01, problems: 1, paidCalls: 2, fixed: 2, original: 3 })).toContain("Fixed 2 of 3"); });
  it("preserves payment uncertainty in shared receipts and fixed reports", () => { for (const diff of [{}, { fixed: 2, original: 3 }]) { const text = shareText({ budgetUsd: .15, spentUsd: .005, problems: 1, paidCalls: 1, paymentUnknown: true, ...diff }); expect(text).toContain("Confirmed paid: $0.005"); expect(text).toContain("another payment is unresolved"); expect(text).not.toContain("It bought"); } });
  it.each(["queued", "prechecking", "planning", "buying", "explaining", "failed", "unreachable"] as const)("shares %s without presenting a completed result", status => {
    const text = shareText({ status, budgetUsd: .15, spentUsd: .005, problems: 0, paidCalls: 1 });
    expect(text).toContain(copy.stages[status]); expect(text).not.toContain("found 0 problems"); expect(text).not.toContain("It bought");
    for (const word of BANNED_WORDS) expect(text).not.toMatch(new RegExp(`\\b${word}\\b`, "i"));
  });
});
