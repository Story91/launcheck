import { describe, expect, it } from "vitest";
import { usDeadlineFacts, usDeadlineSignal } from "../src/pipeline/us-deadline";

describe("usDeadlineFacts", () => {
  it("measures response time from the original posting, not the latest amendment", () => {
    const text = [
      "type: Combined Synopsis/Solicitation",
      "postedDate: 2026-11-04 10:00:00",
      "originalPostedDate: 2026-10-20 09:00:00",
      "responseDeadLine: 2026-11-14T12:00:00-05:00",
    ].join("\n");
    expect(usDeadlineFacts(text)).toEqual({
      procedureType: "Combined Synopsis/Solicitation",
      publicationDate: "2026-10-20",
      deadlineForTenders: "2026-11-14T12:00:00-05:00",
      daysToDeadline: 25,
    });
  });

  it("uses postedDate when there is no earlier version and leaves unknowns null", () => {
    expect(usDeadlineFacts("type: Solicitation\npostedDate: 2026-11-04 20:47:24\nresponseDeadLine: 2026-11-09T07:00:00-06:00")).toEqual({
      procedureType: "Solicitation",
      publicationDate: "2026-11-04",
      deadlineForTenders: "2026-11-09T07:00:00-06:00",
      daysToDeadline: 5,
    });
    expect(usDeadlineFacts("title: x")).toEqual({ procedureType: null, publicationDate: null, deadlineForTenders: null, daysToDeadline: null });
  });
});

describe("usDeadlineSignal (S1 computed in code, FAR 5.203 / 12.603)", () => {
  const facts = (over: Partial<ReturnType<typeof usDeadlineFacts>> = {}) => ({
    procedureType: "Solicitation",
    publicationDate: "2026-11-02",
    deadlineForTenders: "2026-11-13T12:00:00-05:00",
    daysToDeadline: 11,
    ...over,
  });

  it("does not fire for subscriptions or maintenance of off-the-shelf products under 5 days' threshold", () => {
    const s = usDeadlineSignal(facts(), "title: DYNATRACE SUBSCRIPTION MAINTENANCE");
    expect(s).toMatchObject({ id: "S1_SHORT_DEADLINE", fired: false, severity: "none", evidence: [] });
  });

  it("fires medium for a non-commercial solicitation with 11 days and cites both dates", () => {
    const s = usDeadlineSignal(facts(), "title: Base operations support services");
    expect(s).toMatchObject({ fired: true, severity: "medium", evidence: ["2026-11-13T12:00:00-05:00", "2026-11-02"] });
    expect(s?.reason).toMatch(/11 days/);
  });

  it("uses the commercial threshold for combined synopsis/solicitations", () => {
    expect(usDeadlineSignal(facts({ procedureType: "Combined Synopsis/Solicitation", daysToDeadline: 3 }), "title: x")).toMatchObject({ fired: true, severity: "low" });
    expect(usDeadlineSignal(facts({ procedureType: "Combined Synopsis/Solicitation", daysToDeadline: 6 }), "title: x")).toMatchObject({ fired: false });
  });

  it("never fires for notices that do not ask for offers", () => {
    expect(usDeadlineSignal(facts({ procedureType: "Special Notice", daysToDeadline: 2 }), "title: x")).toMatchObject({ fired: false });
  });

  it("returns null when the dates are unknown, so the model's evaluation stays", () => {
    expect(usDeadlineSignal(facts({ daysToDeadline: null }), "title: x")).toBeNull();
  });
});
