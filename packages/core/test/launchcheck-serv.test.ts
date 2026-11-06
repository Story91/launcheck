import { describe, expect, it, vi } from "vitest";
import { launchCheckReasoning } from "../src/launchcheck/serv";
import { launchCheckFixtureReport } from "../src/launchcheck/fixtures";
import { PAID_CHECKS } from "../src/launchcheck/paid";
import type { ChatResult } from "../src/llm/types";
const response = (value: unknown): ChatResult => ({ content: JSON.stringify(value), refusal: null, guardRefused: false, usage: { promptTokens: 100, completionTokens: 50 }, requestId: "serv_test", durationMs: 10, model: "test-model", costUsd: .001 });
describe("LaunchCheck SERV reasoning", () => {
  it("preserves conditional mail-DNS explanations when mail use was not established", async () => {
    const report = launchCheckFixtureReport("fx_problems");
    report.findings[0].checkId = "email_dns";
    report.findings[0].explanation = "Mail use was not established; this may not apply.";
    const chat = vi.fn().mockResolvedValue(response({ explanations: [{findingId:report.findings[0].id,evidenceIds:report.findings[0].evidenceIds,explanation:"Your signup emails will be blocked.",fix:"Change the DNS now."}] }));
    const result = await launchCheckReasoning({chat},"test").explain(report);
    expect(result.findings[0]).toEqual(report.findings[0]); expect(result.audit.droppedItems).toBe(1);
    expect(JSON.parse(chat.mock.calls[0][0].user).findings.some((f: {findingId:string}) => f.findingId === report.findings[0].id)).toBe(false);
  });
  it("rejects invented services, duplicate calls, verdicts and spending above the supplied budget", async () => {
    const chat = vi.fn().mockResolvedValue(response({ buy: [{ checkId: "html_audit", reason: "Second opinion" }, { checkId: "render_desktop", reason: "Browser evidence" }, { checkId: "render_desktop", reason: "Duplicate" }, { checkId: "invented", reason: "Unknown" }, { checkId: "render_narrow", reason: "Guaranteed" }] }));
    const report = launchCheckFixtureReport("fx_problems"); report.budgetUsd = .01;
    const plan = await launchCheckReasoning({ chat }, "test").plan(report, PAID_CHECKS);
    expect(plan.buy.map(c => c.checkId)).toEqual(["render_desktop"]);
    expect(plan.audit.droppedItems).toBe(4); expect(plan.audit.requestId).toBe("serv_test");
    expect(chat.mock.calls[0][0].system).toContain("untrusted");
    expect(chat.mock.calls[0][0].tools.some((t: { function: { name: string } }) => t.function.name === "serv_shadow_agent")).toBe(true);
  });
  it("falls back explicitly on refusal without pretending there was no inference charge", async () => {
    const chat = vi.fn().mockResolvedValue({ ...response(null), content: null, refusal: "refused", guardRefused: true, costUsd: null });
    const plan = await launchCheckReasoning({ chat }, "test").plan(launchCheckFixtureReport("fx_problems"), PAID_CHECKS);
    expect(plan.usedServ).toBe(false); expect(plan.buy.length).toBeGreaterThan(0);
    expect(plan.audit.refused).toBe(true); expect(plan.audit.costUsd).toBeNull();
  });
  it("keeps transport failure explicit with an unknown model cost", async () => {
    const plan = await launchCheckReasoning({ chat: vi.fn().mockRejectedValue(new Error("timeout")) }, "test").plan(launchCheckFixtureReport("fx_problems"), PAID_CHECKS);
    expect(plan.usedServ).toBe(false); expect(plan.audit.costUsd).toBeNull(); expect(plan.audit.requestId).toBeNull();
  });
  it("never lets the model create findings or attach unrelated evidence", async () => {
    const report = launchCheckFixtureReport("fx_problems");
    const chat = vi.fn().mockResolvedValue(response({ explanations: [
      { findingId: "invented", evidenceIds: ["fake"], explanation: "Invented", fix: "Invented" },
      { findingId: report.findings[0].id, evidenceIds: ["unrelated"], explanation: "Unsupported", fix: "Unsupported" },
      { findingId: report.findings[1].id, evidenceIds: report.findings[1].evidenceIds, explanation: "The recorded response is HTTP 404.", fix: "Inspect the route and update the broken link." },
    ] }));
    const result = await launchCheckReasoning({ chat }, "test").explain(report);
    expect(result.findings).toHaveLength(report.findings.length);
    expect(result.findings[0]).toEqual(report.findings[0]);
    expect(result.findings[1].explainedBy).toBe("serv"); expect(result.findings[1].observed).toBe(report.findings[1].observed);
    expect(result.audit.droppedItems).toBe(2);
  });
});
