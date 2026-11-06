// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ReportView } from "./report-view";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("shows a retryable error when generation is unavailable instead of silently waiting", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
  render(<ReportView noticeId="722731-2026" initial={null} />);
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Could not start"));
  expect(screen.getByRole("button", { name: "Start again" })).toBeDefined();
});

it("handles a network failure without an unhandled rejection", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
  render(<ReportView noticeId="722731-2026" initial={null} />);
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Could not start"));
});
