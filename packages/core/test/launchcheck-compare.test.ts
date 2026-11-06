import { describe, expect, it } from "vitest";
import { compareReports } from "../src/launchcheck/compare";
import { launchCheckFixtureReport } from "../src/launchcheck/fixtures";
describe("evidence-backed rerun comparison", () => {
  it("counts a fix only when its check ran again with evidence", () => {
    const parent = launchCheckFixtureReport("fx_problems"), current = launchCheckFixtureReport("fx_fixed");
    const diff = compareReports(parent, current)!;
    expect(diff.fixed).toContain(parent.findings[0].id); expect(diff.unresolved).toEqual([]);
  });
  it("keeps a disappeared finding unresolved when the new check was unavailable", () => {
    const parent = launchCheckFixtureReport("fx_problems"), current = launchCheckFixtureReport("fx_fixed");
    const check = current.checks.find(c => c.checkId === parent.findings[0].checkId)!;
    check.state = "not_checked"; check.evidenceIds = [];
    const diff = compareReports(parent, current)!;
    expect(diff.fixed).not.toContain(parent.findings[0].id); expect(diff.unresolved).toContain(parent.findings[0].id);
  });
  it("rejects comparing different pages or an unfinished run", () => {
    const parent = launchCheckFixtureReport("fx_problems"), current = launchCheckFixtureReport("fx_fixed");
    current.url = "https://example.com/different"; expect(compareReports(parent,current)).toBeNull();
    current.url = parent.url; current.status = "buying"; expect(compareReports(parent,current)).toBeNull();
  });
  it("does not count a changed response code as a fixed route", () => {
    const parent = launchCheckFixtureReport("fx_problems"), current = structuredClone(parent); current.id = "lc_new";
    current.findings[1].id = "different_id"; current.findings[1].observed = current.findings[1].observed.replace("404", "500");
    const diff = compareReports(parent,current)!;
    expect(diff.stillThere).toContain(parent.findings[1].id); expect(diff.new).toEqual([]);
  });
  it("keeps an unprobed link unresolved even when other link checks succeeded", () => {
    const parent = launchCheckFixtureReport("fx_problems"), current = launchCheckFixtureReport("fx_fixed");
    current.evidence.find(e => e.checkId === "link_status")!.fields = { links: [{url:"https://example.com/other",status:200}] };
    expect(compareReports(parent,current)?.unresolved).toContain("f_link");
    current.evidence.find(e => e.checkId === "link_status")!.fields = { links: [], discoveryComplete:true, discoveredUrls:["https://example.com/other"] };
    expect(compareReports(parent,current)?.fixed).toContain("f_link");
  });
});
