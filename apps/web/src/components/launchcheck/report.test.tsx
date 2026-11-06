// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ReportView, Receipt } from "./report";
import { ShareActions } from "./share-actions";
import { fixtureReport } from "./mocks/fixtures";
import { copy } from "./copy";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
afterEach(cleanup);
describe("evidence and receipt semantics", () => {
  it("keeps unknown checks neutral even with zero findings", () => { render(<ReportView report={fixtureReport("fx_clean")}/>); const unknown = screen.getByText(copy.checkStates.not_checked, { selector: ".lc-status" }); expect(unknown.className).toContain("lc-status-not_checked"); expect(unknown.className).not.toContain("clear"); expect(screen.getByText(copy.outside)).toBeTruthy(); expect(screen.getByText(copy.noFindingsCaveat)).toBeTruthy(); });
  it("shows charged failures, uncertainty and the layer that stopped spending", () => { const report = fixtureReport("fx_problems"); report.receipt.lines[0].status = "failed_charged"; report.receipt.lines[1].status = "payment_unknown"; report.receipt.stoppedBy = "kite_policy"; render(<Receipt report={report}/>); expect(screen.getByText(copy.receiptStates.failed_charged)).toBeTruthy(); expect(screen.getByText(copy.confirmedSpend)).toBeTruthy(); expect(screen.getByText(copy.unknownSpend)).toBeTruthy(); expect(screen.getByText(copy.stopsBy.kite_policy)).toBeTruthy(); });
  it("never inserts provider markup as HTML", () => { const report = fixtureReport("fx_problems"); report.findings[0].observed = '<img src=x onerror="alert(1)">'; const { container } = render(<ReportView report={report}/>); expect(screen.getByText(report.findings[0].observed)).toBeTruthy(); expect(container.querySelector('img[src="x"]')).toBeNull(); });
  it("does not give non-owners deletion or rerun actions", () => { const report = fixtureReport("fx_problems"); report.id = "lc_real"; report.isRequester = false; render(<ReportView report={report}/>); expect(screen.queryByText(copy.remove)).toBeNull(); expect(screen.queryByText(copy.rerun)).toBeNull(); });
  it("does not offer another paid run while the owner's check is still running", () => { const report = fixtureReport("fx_problems"); report.id = "lc_real"; report.isRequester = true; report.status = "buying"; render(<ShareActions report={report}/>); expect(screen.queryByText(copy.rerun)).toBeNull(); expect(screen.getByText(copy.remove)).toBeTruthy(); cleanup(); report.status = "done"; render(<ShareActions report={report}/>); expect(screen.getByText(copy.rerun)).toBeTruthy(); });
  it("shows missing referenced evidence instead of manufacturing a source", () => { const report = fixtureReport("fx_problems"); report.findings[0].evidenceIds = ["missing"]; render(<ReportView report={report}/>); expect(screen.getByText(copy.unmatched)).toBeTruthy(); });
});
