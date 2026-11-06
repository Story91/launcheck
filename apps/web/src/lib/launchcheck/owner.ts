import { createHash } from "node:crypto";
import { runStore } from "./run-store";
export function creatorToken(req: Request): string | null {
  const value = /(?:^|;\s*)lc_creator=([^;]+)/.exec(req.headers.get("cookie") ?? "")?.[1];
  return value && /^[A-Za-z0-9_-]{32}$/.test(value) ? value : null;
}
export async function isRunOwner(req: Request, id: string) {
  const token = creatorToken(req);
  return !!token && (await runStore().creatorHash(id)) === createHash("sha256").update(token).digest("hex");
}
