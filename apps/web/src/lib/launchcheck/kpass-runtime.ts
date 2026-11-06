import { execFile } from "node:child_process";
import { chmod, copyFile, mkdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Kite Passport has no public HTTP API, so the server runs the official kpass CLI (Linux build fetched and
// checksum-verified at build time by scripts/fetch-kpass.mjs). Credentials come from three base64 env vars the owner
// pasted into Vercel as sensitive values; they are written to /tmp on each cold start, never logged or returned.

const FILES = { "config.json": "KPASS_CONFIG_JSON_B64", "agent.json": "KPASS_AGENT_JSON_B64", "sessions.json": "KPASS_SESSIONS_JSON_B64" } as const;
type FileName = keyof typeof FILES;

export function kpassFilesFromEnv(env: Record<string, string | undefined>): Record<FileName, string> | null {
  const out = {} as Record<FileName, string>;
  for (const [file, key] of Object.entries(FILES) as [FileName, string][]) {
    const value = env[key];
    if (!value) return null;
    const text = Buffer.from(value, "base64").toString("utf8");
    try {
      JSON.parse(text);
    } catch {
      return null;
    }
    out[file] = text;
  }
  return out;
}

/** Child-process env: only PATH from the parent, every home dir pointed at the temp root, no updates, browser or prompts. */
export function kpassChildEnv(root: string, parent: Record<string, string | undefined>): Record<string, string> {
  return {
    PATH: parent.PATH ?? "/usr/bin:/bin",
    HOME: root,
    USERPROFILE: root,
    KPASS_HOME: root,
    KPASS_NO_UPDATE_CHECK: "1",
    KPASS_AUTO_UPGRADE: "0",
    KPASS_NO_BROWSER: "1",
    CI: "1",
  };
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" ? (v as Json) : {});

/** `kpass status` reduced to non-secret fields (no tokens, keys, emails or full ids). */
export function sanitizeStatus(raw: unknown) {
  const r = obj(raw), backend = obj(r.backend), user = obj(r.user), agent = obj(r.agent), session = obj(r.session);
  const agentId = typeof agent.agent_id === "string" ? agent.agent_id : "";
  return {
    ok: r.status === "success",
    backendReachable: backend.reachable === true,
    backendUrl: typeof backend.url === "string" ? backend.url : null,
    loggedIn: user.logged_in === true,
    jwtValid: user.jwt_valid === true,
    agentRegistered: agent.registered === true,
    agentType: typeof agent.type === "string" ? agent.type : null,
    agentIdShort: agentId ? `…${agentId.slice(-4)}` : null,
    sessionActive: session.active === true,
    hint: typeof r.hint === "string" ? r.hint : null,
  };
}

/** `kpass allowance status` reduced to the public meter; null when no allowance is active. */
export function sanitizeAllowance(raw: unknown, readAt: string) {
  const r = obj(raw);
  if (r.state !== "active") return null;
  return {
    limitUsd: Number(r.amount),
    leftUsd: Number(r.left),
    period: String(r.period ?? ""),
    resetsAt: String(r.reset_at ?? ""),
    readAt,
    state: "active" as const,
  };
}

const ROOT = "/tmp/kp";
const BINARY_SOURCE = join(process.cwd(), ".kpass-bin", "kpass");

export class KpassUnavailableError extends Error {}

/** Writes credentials and the binary into /tmp once per instance. */
async function prepare(): Promise<string> {
  const files = kpassFilesFromEnv(process.env);
  if (!files) throw new KpassUnavailableError("kpass credentials are not configured (KPASS_*_JSON_B64)");
  const dir = join(ROOT, ".kite-passport");
  await mkdir(dir, { recursive: true, mode: 0o700 });
  for (const [name, text] of Object.entries(files)) await writeFile(join(dir, name), text, { mode: 0o600 });
  const binary = join(ROOT, "kpass");
  try {
    await stat(binary);
  } catch {
    try {
      await copyFile(BINARY_SOURCE, binary);
    } catch {
      throw new KpassUnavailableError("kpass binary is not bundled with this deployment");
    }
    await chmod(binary, 0o755);
  }
  return binary;
}

export interface KpassResult {
  exitCode: number;
  json: unknown;
}

/** Runs kpass with `--output json` appended; never throws on a non-zero exit (the JSON envelope carries the error). */
export async function runKpass(args: string[], timeoutMs = 60_000): Promise<KpassResult> {
  const binary = await prepare();
  return new Promise((resolve) => {
    execFile(binary, [...args, "--output", "json"], { cwd: ROOT, env: kpassChildEnv(ROOT, process.env) as unknown as NodeJS.ProcessEnv, encoding: "utf8", timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 }, (error, stdout: string) => {
      const exitCode = error ? (typeof (error as { code?: unknown }).code === "number" ? ((error as { code: number }).code) : 1) : 0;
      let json: unknown = null;
      try {
        json = JSON.parse(stdout);
      } catch {
        json = null;
      }
      resolve({ exitCode, json });
    });
  });
}
