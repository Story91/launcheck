import { describe, expect, it } from "vitest";
import { browserConnection, runBrowserJourney } from "../src/launchcheck/browser";
describe("purchased browser connections", () => {
  it("reads a Browserbase connection but rejects arbitrary endpoints and embedded credentials", () => {
    expect(browserConnection({ data: { connectUrl: "wss://connect.browserbase.com?sessionId=example" } })).toContain("connect.browserbase.com");
    expect(browserConnection({ data: { connectUrl: "wss://connect.browserbase.com.attacker.test" } })).toBeNull();
    expect(browserConnection({ connectUrl: "wss://user:secret@connect.browserbase.com" })).toBeNull();
    expect(browserConnection({ connectUrl: "ws://localhost:9222" })).toBeNull();
  });
  it("does not connect to a foreign websocket when processing vendor data", async () => {
    const result = await runBrowserJourney("wss://attacker.test", "https://example.com");
    expect(result.steps).toEqual([]); expect(result.error).toBeTruthy();
  });
});
