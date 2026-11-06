import { afterEach, describe, expect, it, vi } from "vitest";
import { isLaunchcheckOperator } from "./operator";
afterEach(() => vi.unstubAllEnvs());
const request = (token: string) => new Request("https://launch.example/api/admin/launchcheck-demo", { headers: { authorization: `Bearer ${token}` } });
describe("owner-only acceptance controls", () => {
  it("accepts the configured owner key and rejects missing or wrong keys", () => {
    vi.stubEnv("CRON_SECRET","owner-only");
    expect(isLaunchcheckOperator(request("owner-only"))).toBe(true);
    expect(isLaunchcheckOperator(request("wrong"))).toBe(false);
    expect(isLaunchcheckOperator(new Request("https://launch.example"))).toBe(false);
  });
  it("expires a temporary test key and never treats malformed keys as permanent", () => {
    vi.stubEnv("CRON_SECRET","");
    const active = `${Math.floor(Date.now()/1000)+60}.${"a".repeat(64)}`;
    vi.stubEnv("LAUNCHCHECK_OPERATOR_TOKEN",active); expect(isLaunchcheckOperator(request(active))).toBe(true);
    const old = `1000000000.${"b".repeat(64)}`;
    vi.stubEnv("LAUNCHCHECK_OPERATOR_TOKEN",old); expect(isLaunchcheckOperator(request(old))).toBe(false);
    vi.stubEnv("LAUNCHCHECK_OPERATOR_TOKEN","malformed"); expect(isLaunchcheckOperator(request("malformed"))).toBe(false);
  });
});
