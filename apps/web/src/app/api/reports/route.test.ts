import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({ after: vi.fn(), get: vi.fn(), deps: vi.fn() }));
vi.mock("next/server", () => ({ after: mocks.after, NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } }));
vi.mock("@/lib/store", () => ({ reportStore: () => ({ get: mocks.get }) }));
vi.mock("@/lib/deps", () => ({ buildPipelineDeps: mocks.deps }));
vi.mock("@/lib/reports", () => ({ STALE_GENERATION_MS: 300000, startGeneration: vi.fn() }));

beforeEach(() => { vi.clearAllMocks(); mocks.get.mockResolvedValue(null); mocks.deps.mockReturnValue({}); });
const post = (body: unknown) => POST(new Request("https://tendr.test/api/reports", { method: "POST", body: JSON.stringify(body) }));

describe("report requests", () => {
  it.each([null, [], { noticeId: 123 }, { noticeId: {} }, { noticeId: false }, {}])("rejects invalid JSON shapes with 400: %j", async (body) => {
    expect((await post(body)).status).toBe(400);
    expect(mocks.after).not.toHaveBeenCalled();
  });
  it("reports missing configuration before accepting background work", async () => {
    mocks.deps.mockImplementation(() => { throw new Error("SERV_API_KEY is not set"); });
    const res = await post({ noticeId: "722731-2026" });
    expect(res.status).toBe(503);
    expect(mocks.after).not.toHaveBeenCalled();
  });
  it("accepts a SAM.gov identifier", async () => {
    expect((await post({ noticeId: "0123456789abcdef0123456789abcdef" })).status).toBe(202);
    expect(mocks.after).toHaveBeenCalledOnce();
  });
});
