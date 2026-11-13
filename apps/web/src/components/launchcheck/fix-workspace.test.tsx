// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FixWorkspace } from "./fix-workspace";
import { fixtureReport } from "./mocks/fixtures";
import { experience as text } from "./experience-copy";
afterEach(cleanup);
describe("fix workspace", () => {
  it("exports only the selected finding, preserves evidence, and never marks it fixed", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const report = fixtureReport("fx_problems");
    const original = JSON.stringify(report);
    render(<FixWorkspace report={report}/>);
    fireEvent.click(screen.getByText(text.fixes.none));
    expect((screen.getByText(text.fixes.download) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByText(text.fixes.ai));
    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    const content = writeText.mock.calls[0][0];
    const data = JSON.parse(content.slice(content.indexOf("{\n")));
    expect(data.findings).toHaveLength(1);
    expect(data.findings[0].observed).toBe(report.findings[0].observed);
    expect(data.findings[0].evidence.length).toBe(report.findings[0].evidenceIds.length);
    expect(data.notChecked).toEqual(report.notChecked);
    expect(data.illustrative).toBe(true);
    expect(JSON.stringify(report)).toBe(original);
  });
  it("can select only the findings a page edit can change", () => {
    const report = fixtureReport("fx_problems");
    report.findings[0].ruleId = "csp_missing"; report.findings[1].ruleId = "og_image_missing";
    render(<FixWorkspace report={report}/>);
    fireEvent.click(screen.getByText(text.fixes.pageOnly));
    const boxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    expect(boxes.map(box => box.checked)).toEqual([false, true]);
    expect(screen.getAllByText(/Change in/, { selector: ".lc-fix-area" })).toHaveLength(2);
  });
  it("opens a manual copy fallback if clipboard permission is denied", async () => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) }, configurable: true });
    render(<FixWorkspace report={fixtureReport("fx_problems")}/>);
    fireEvent.click(screen.getByText(text.fixes.all));
    fireEvent.click(screen.getByText(text.fixes.ai));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe(text.fixes.manual));
    expect(screen.getByText(text.fixes.preview, { selector: "summary" }).parentElement?.hasAttribute("open")).toBe(true);
  });
});
