// @vitest-environment jsdom
import type { Signal } from "@tenderhound/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SignalCard } from "@/components/signal-card";

const fired: Signal = {
  id: "S2_BRAND_LOCK",
  fired: true,
  severity: "high",
  reason: "A named incumbent system must be integrated and no equivalence clause is present.",
  evidence: ["integracją z Systemem DarkTrace", "DarkTrace"],
};

const unfired: Signal = {
  id: "S5_PRICE_WEIGHT_LOW",
  fired: false,
  severity: "none",
  reason: "Price carries 100% of the award weight.",
  evidence: [],
};

describe("SignalCard", () => {
  it("renders a fired signal with its id, severity and each quote in a blockquote", () => {
    const { container } = render(<SignalCard signal={fired} />);
    expect(screen.getByText("S2_BRAND_LOCK")).toBeTruthy();
    expect(screen.getByText("high")).toBeTruthy();
    const quotes = container.querySelectorAll("blockquote");
    expect(quotes).toHaveLength(2);
    expect(quotes[0]?.textContent).toContain("integracją z Systemem DarkTrace");
  });

  it("renders an unfired signal muted, with no blockquote", () => {
    const { container } = render(<SignalCard signal={unfired} />);
    expect(screen.getByText("S5_PRICE_WEIGHT_LOW")).toBeTruthy();
    expect(container.querySelectorAll("blockquote")).toHaveLength(0);
    expect(container.firstElementChild?.getAttribute("data-fired")).toBe("false");
  });
});
