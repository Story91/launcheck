import { describe, expect, it } from "vitest";
import { usDeadlineFacts } from "../src/pipeline/us-deadline";

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
