import { z } from "zod";
import { agentSchema, catalogSchema, gallerySchema, reportSchema, checkCreatedSchema, type Tier, type Venue } from "./contract";
import { copy } from "./copy";
export class ApiError extends Error { constructor(message: string, public code: string, public retryAfterSec?: number) { super(message); } }
async function json(response: Response) {
  let body: Record<string, unknown>; try { body = await response.json(); } catch { throw new ApiError(copy.api.unavailable, "unavailable"); }
  if (!response.ok) { const code = typeof body.error === "string" ? body.error : "unavailable"; const reason = typeof body.reason === "string" ? body.reason : "paused"; const seconds = typeof body.retryAfterSec === "number" ? body.retryAfterSec : undefined;
    const message = code === "live_runs_paused" ? copy.api[reason as "paused"] ?? copy.api.paused : code === "rate_limited" ? `${copy.api.rate_limited} ${Math.ceil((seconds ?? 60) / 60)} min.` : code === "invalid_url" ? copy.api.invalid_url : code === "blocked_url" ? copy.api.blocked_url : response.status === 403 || response.status === 401 ? copy.api.auth : copy.api.unavailable;
    throw new ApiError(message, code, seconds);
  } return body;
}
async function validated<T>(path: string, schema: z.ZodType<T>, signal?: AbortSignal) { const parsed = schema.safeParse(await json(await fetch(path, { cache: "no-store", signal }))); if (!parsed.success) throw new ApiError(copy.api.format, "format"); return parsed.data; }
export const readReport = (id: string, signal?: AbortSignal) => validated(`/api/checks/${encodeURIComponent(id)}`, reportSchema, signal);
export const readAgent = (fixture: boolean, signal?: AbortSignal) => validated(`/api/agent${fixture ? "?fixture=1" : ""}`, agentSchema, signal);
export const readCatalog = (signal?: AbortSignal) => validated("/api/catalog", catalogSchema, signal);
export const readGallery = (fixture: boolean, signal?: AbortSignal) => validated(`/api/gallery${fixture ? "?fixture=1" : ""}`, gallerySchema, signal);
const created = checkCreatedSchema;
export async function createCheck(url: string, tier: Tier, venue: Venue, signal?: AbortSignal) { const data = await json(await fetch("/api/checks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, tier, venue }), signal })); const result = created.safeParse(data); if (!result.success) throw new ApiError(copy.api.format, "format"); return result.data; }
export async function rerunCheck(id: string) { const result = created.safeParse(await json(await fetch(`/api/checks/${encodeURIComponent(id)}/rerun`, { method: "POST" }))); if (!result.success) throw new ApiError(copy.api.format, "format"); return result.data; }
export async function deleteCheck(id: string) { const response = await fetch(`/api/checks/${encodeURIComponent(id)}`, { method: "DELETE" }); if (!response.ok) await json(response); }
