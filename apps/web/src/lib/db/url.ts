/** Candidate variable names, in priority order: ours first, then what the Vercel Neon integration creates per prefix. */
const CANDIDATES = ["DATABASE_URL", "STORAGE_URL", "POSTGRES_URL", "STORAGE_POSTGRES_URL", "DATABASE_POSTGRES_URL", "NEON_DATABASE_URL"] as const;

const POSTGRES_URL = /^postgres(ql)?:\/\/\S+$/;

/** First variable that holds a real postgres:// URL; placeholders and empty strings are ignored. */
export function resolveDatabaseUrl(env: Record<string, string | undefined>): string | null {
  for (const key of CANDIDATES) {
    const value = (env[key] ?? "").trim();
    if (POSTGRES_URL.test(value)) return value;
  }
  return null;
}
