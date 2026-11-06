import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as reppo } from "./reppo/route";
import { GET as samImport } from "./sam-import/route";

const calls = vi.hoisted(() => ({ buildReppoClient: vi.fn(() => null), importSamNotices: vi.fn() }));
vi.mock("@/lib/deps", () => ({ buildReppoClient: calls.buildReppoClient }));
vi.mock("@/lib/sam-notices", () => ({ importSamNotices: calls.importSamNotices, samNoticeStore: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe.each([["Reppo", reppo], ["SAM import", samImport]] as const)("%s cron authorization", (_name, get) => {
  it("refuses to run when CRON_SECRET is absent", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await get(new Request("https://tendr.test/api/cron/job"));
    expect(res.status).toBe(401);
    expect(calls.buildReppoClient).not.toHaveBeenCalled();
    expect(calls.importSamNotices).not.toHaveBeenCalled();
  });
  it("refuses an incorrect bearer token", async () => {
    vi.stubEnv("CRON_SECRET", "expected");
    const res = await get(new Request("https://tendr.test/api/cron/job", { headers: { authorization: "Bearer wrong" } }));
    expect(res.status).toBe(401);
  });
});

it("allows the configured cron bearer token", async () => {
  vi.stubEnv("CRON_SECRET", "expected");
  expect((await reppo(new Request("https://tendr.test/api/cron/reppo", { headers: { authorization: "Bearer expected" } }))).status).toBe(200);
  expect(calls.buildReppoClient).toHaveBeenCalledOnce();
});
