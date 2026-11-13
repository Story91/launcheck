// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { Changes } from "./changes";
import { readReport } from "./api";
import { fixtureReport } from "./mocks/fixtures";
import { copy, remainingOutsidePage } from "./copy";
vi.mock("./api", () => ({ readReport: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe("evidence-backed changes", () => {
  it("retrieves original observations for resolved findings", async () => {
    const parent = fixtureReport("fx_problems"); vi.mocked(readReport).mockResolvedValue(parent);
    render(<Changes report={fixtureReport("fx_fixed")}/>);
    await screen.findByText(parent.findings[0].title);
    expect(screen.getByText(parent.findings[0].observed)).toBeTruthy();
    expect(screen.getByText(copy.comparisonScope)).toBeTruthy();
  });
  it("does not borrow observations from an unrelated site", async () => {
    const parent = fixtureReport("fx_problems"); parent.origin = "https://unrelated.example";
    vi.mocked(readReport).mockResolvedValue(parent); render(<Changes report={fixtureReport("fx_fixed")}/>);
    await screen.findByText(copy.previousUnavailable);
    expect(screen.queryByText(parent.findings[0].observed)).toBeNull();
  });
  it("keeps counts inspectable when the source was removed", async () => {
    vi.mocked(readReport).mockRejectedValue(new Error("not found")); render(<Changes report={fixtureReport("fx_fixed")}/>);
    await screen.findByText(copy.previousUnavailable);
    expect(screen.getByText("f_og")).toBeTruthy();
    expect(screen.getByRole("link", { name: copy.previous }).getAttribute("href")).toBe("/check/fx_problems");
  });
  it("explains remaining findings that a page edit cannot remove", async () => {
    const parent = fixtureReport("fx_problems"); vi.mocked(readReport).mockResolvedValue(parent);
    const report = fixtureReport("fx_fixed");
    report.findings = [{ ...parent.findings[0], id: "f_csp", ruleId: "csp_missing", title: "No CSP header" }, { ...parent.findings[0], id: "f_spf", ruleId: "spf_missing", title: "No SPF record" }];
    report.diff = { ...report.diff!, fixed: ["f_og"], stillThere: ["f_csp", "f_spf"] };
    render(<Changes report={report}/>);
    await screen.findByText("No CSP header");
    expect(screen.getByText(copy.fixAreas.server, { selector: ".lc-fix-area" })).toBeTruthy();
    expect(screen.getByText(copy.fixAreas.dns, { selector: ".lc-fix-area" })).toBeTruthy();
    expect(screen.getByText(remainingOutsidePage(2, 2))).toBeTruthy();
  });
  it("does not fetch another run for a first check", async () => {
    render(<Changes report={fixtureReport("fx_clean")}/>);
    await waitFor(() => expect(readReport).not.toHaveBeenCalled());
  });
});
