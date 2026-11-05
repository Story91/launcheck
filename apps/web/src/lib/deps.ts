import { DolphinClient, ReppoClient, ServClient, type PipelineDeps } from "@tendr/core";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

/** Builds pipeline dependencies from the environment (see .env.example). */
export function buildPipelineDeps(): PipelineDeps {
  const dolphinPrimary = process.env.DOLPHIN_PRIMARY === "true" && !!process.env.DOLPHIN_API_KEY;
  return {
    serv: new ServClient({ apiKey: required("SERV_API_KEY"), baseUrl: process.env.SERV_BASE_URL }),
    dolphin: dolphinPrimary ? new DolphinClient({ apiKey: process.env.DOLPHIN_API_KEY!, baseUrl: process.env.DOLPHIN_BASE_URL }) : null,
    servModel: process.env.SERV_MODEL ?? "gpt-6-luna",
    fallbackModel: process.env.SERV_FALLBACK_MODEL ?? "gpt-5.4-mini",
    extractModel: process.env.SERV_EXTRACT_MODEL ?? "gemini-3.1-flash-lite",
    dolphinModel: process.env.DOLPHIN_MODEL,
    samApiKey: process.env.SAM_API_KEY,
  };
}

export function buildReppoClient(): ReppoClient | null {
  const apiKey = process.env.REPPO_EVAL_API_KEY;
  if (!apiKey) return null;
  // Explicit REPPO_SANDBOX wins; otherwise production uses real evaluations and everything else the free sandbox.
  const sandbox = process.env.REPPO_SANDBOX !== undefined ? process.env.REPPO_SANDBOX !== "false" : process.env.VERCEL_ENV !== "production";
  return new ReppoClient({ apiKey, baseUrl: process.env.REPPO_EVAL_BASE_URL, sandbox });
}

export function internalSecret(): string {
  return required("INTERNAL_SECRET");
}
