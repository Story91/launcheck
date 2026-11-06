// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Checklist } from "./checklist";
import { fixtureReport } from "./mocks/fixtures";
import { copy } from "./copy";
afterEach(cleanup);
describe("check outcome filters", () => {
  it("isolates unknown outcomes without changing them into successful checks", () => {
    const report = fixtureReport("fx_clean"); const { container } = render(<Checklist report={report}/>);
    const button = screen.getByRole("button", { name: new RegExp(copy.checkStates.not_checked) }); fireEvent.click(button);
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelectorAll(".lc-test").length).toBe(report.checks.filter(c => c.state === "not_checked").length);
    expect(container.querySelector(".lc-status-clear")).toBeNull();
  });
  it("can return to every check and explicitly shows an empty filter", () => {
    const report = fixtureReport("fx_problems"); const { container } = render(<Checklist report={report}/>);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(copy.inProgress) }));
    expect(screen.getByText(copy.noChecksInFilter)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(copy.allChecks) }));
    expect(container.querySelectorAll(".lc-test").length).toBe(report.checks.length);
  });
});
