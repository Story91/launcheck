import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { resolveDatabaseUrl } from "./url";

let cached: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function db() {
  if (cached) return cached;
  const url = resolveDatabaseUrl(process.env);
  if (!url) throw new Error("No postgres connection string found (DATABASE_URL / STORAGE_URL / POSTGRES_URL)");
  cached = drizzle(neon(url), { schema });
  return cached;
}

export { schema };
