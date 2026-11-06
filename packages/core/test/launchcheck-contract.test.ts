import { describe, expect, it } from "vitest";
import {
  LAUNCHCHECK_FIXTURE_IDS,
  isLaunchCheckFixtureId,
  launchCheckFixtureAgent,
  launchCheckFixtureCatalog,
  launchCheckFixtureGallery,
  launchCheckFixtureReport,
} from "../src/launchcheck/fixtures";
import { agentStatusSchema, catalogSchema, gallerySchema, launchCheckErrorSchema, launchCheckReportSchema } from "../src/launchcheck/types";
import { BANNED_WORDS, findBannedWords } from "../src/launchcheck/wording";

describe("findBannedWords", () => {
  it("finds verdict words as whole words, case-insensitive", () => {
    expect(findBannedWords("Your site is Ready to launch and SAFE")).toEqual(["safe", "ready"]);
    expect(findBannedWords("Launch score: 92")).toEqual(["score"]);
    expect(findBannedWords("Agent preflight done")).toEqual(["preflight"]);
  });
  it("allows the HTTP term 'security headers' and ignores substrings of other words", () => {
    expect(findBannedWords("We read the security headers of the homepage")).toEqual([]);
    expect(findBannedWords("Already scored? Unsafe? Riskless?")).toEqual([]);
  });
  it("lists every banned word once", () => {
    expect(new Set(BANNED_WORDS).size).toBe(BANNED_WORDS.length);
  });
});

describe("LaunchCheck fixtures match the frozen contract", () => {
  it("every fixture report validates, including every progress phase of fx_running", () => {
    for (const id of LAUNCHCHECK_FIXTURE_IDS) expect(launchCheckReportSchema.safeParse(launchCheckFixtureReport(id)).success).toBe(true);
    for (let phase = 0; phase <= 5; phase++) {
      const r = launchCheckFixtureReport("fx_running", phase);
      expect(launchCheckReportSchema.safeParse(r).success).toBe(true);
    }
    expect(launchCheckFixtureReport("fx_running", 0).status).toBe("queued");
    expect(launchCheckFixtureReport("fx_running", 5).status).toBe("done");
  });

  it("catalog, agent and gallery fixtures validate", () => {
    expect(catalogSchema.safeParse(launchCheckFixtureCatalog).success).toBe(true);
    expect(agentStatusSchema.safeParse(launchCheckFixtureAgent).success).toBe(true);
    expect(gallerySchema.safeParse(launchCheckFixtureGallery).success).toBe(true);
  });

  it("fixture copy never uses banned words", () => {
    for (const id of LAUNCHCHECK_FIXTURE_IDS) {
      const r = launchCheckFixtureReport(id);
      const text = [r.error ?? "", ...r.notChecked, ...r.findings.flatMap((f) => [f.title, f.observed, f.explanation, f.fix]), ...r.checks.map((c) => `${c.label} ${c.scopeNote ?? ""}`)].join(" \n ");
      expect(findBannedWords(text)).toEqual([]);
    }
  });

  it("a fixed rerun points at its parent and lists what was fixed", () => {
    const r = launchCheckFixtureReport("fx_fixed");
    expect(r.parentId).toBe("fx_problems");
    expect(r.diff?.fixed.length).toBeGreaterThan(0);
  });

  it("recognises fixture ids only", () => {
    expect(isLaunchCheckFixtureId("fx_clean")).toBe(true);
    expect(isLaunchCheckFixtureId("lc_7Hq2x9KpLm")).toBe(false);
  });

  it("error bodies are a closed set", () => {
    expect(launchCheckErrorSchema.safeParse({ error: "live_runs_paused", reason: "paused", galleryUrl: "/gallery" }).success).toBe(true);
    expect(launchCheckErrorSchema.safeParse({ error: "live_runs_paused", reason: "because" }).success).toBe(false);
  });
});
