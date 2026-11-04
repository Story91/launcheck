import { describe, expect, it } from "vitest";
import { resolveDatabaseUrl } from "@/lib/db/url";

describe("resolveDatabaseUrl", () => {
  it("prefers DATABASE_URL when it is a real postgres URL", () => {
    expect(resolveDatabaseUrl({ DATABASE_URL: "postgresql://u:p@h/db", STORAGE_URL: "postgres://other" })).toBe("postgresql://u:p@h/db");
  });

  it("skips a placeholder DATABASE_URL and falls back to the Vercel/Neon integration variables", () => {
    expect(resolveDatabaseUrl({ DATABASE_URL: "<connection string z Neon>", STORAGE_URL: "postgres://u:p@h/db" })).toBe("postgres://u:p@h/db");
    expect(resolveDatabaseUrl({ POSTGRES_URL: "postgres://u:p@h/db" })).toBe("postgres://u:p@h/db");
    expect(resolveDatabaseUrl({ STORAGE_POSTGRES_URL: "postgres://u:p@h/db" })).toBe("postgres://u:p@h/db");
  });

  it("returns null when nothing usable is set", () => {
    expect(resolveDatabaseUrl({ DATABASE_URL: "", STORAGE_URL: "not a url" })).toBeNull();
    expect(resolveDatabaseUrl({})).toBeNull();
  });
});
