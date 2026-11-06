import { afterEach, expect, it, vi } from "vitest";
import { liveRunsEnabled, dailyCapUsd } from "./executor";
afterEach(() => vi.unstubAllEnvs());
it("requires both integrations, the owner switch and an unexpired public execution period", () => {
  for (const key of ["KPASS_CONFIG_JSON_B64","KPASS_AGENT_JSON_B64","KPASS_SESSIONS_JSON_B64"]) vi.stubEnv(key,Buffer.from("{}").toString("base64"));
  vi.stubEnv("SERV_API_KEY", "unit-test-key"); vi.stubEnv("LAUNCHCHECK_LIVE","1"); vi.stubEnv("LAUNCHCHECK_LIVE_UNTIL","2099-01-01T00:00:00Z");
  expect(liveRunsEnabled()).toBe(true);
  vi.stubEnv("LAUNCHCHECK_LIVE_UNTIL","2020-01-01T00:00:00Z"); expect(liveRunsEnabled()).toBe(false);
  vi.stubEnv("LAUNCHCHECK_LIVE_UNTIL","invalid"); expect(liveRunsEnabled()).toBe(false);
  vi.stubEnv("LAUNCHCHECK_LIVE_UNTIL","2099-01-01T00:00:00Z"); vi.stubEnv("SERV_API_KEY",""); expect(liveRunsEnabled()).toBe(false);
  vi.stubEnv("SERV_API_KEY","unit-test-key"); vi.stubEnv("LAUNCHCHECK_LIVE","0"); expect(liveRunsEnabled()).toBe(false);
});
it("fails closed for invalid allocation caps", () => {
  for (const cap of ["invalid","-1","Infinity"]) { vi.stubEnv("LAUNCHCHECK_DAILY_CAP_USD",cap); expect(dailyCapUsd()).toBe(0); }
  vi.stubEnv("LAUNCHCHECK_DAILY_CAP_USD","1.5"); expect(dailyCapUsd()).toBe(1.5);
});
