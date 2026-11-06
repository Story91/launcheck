import type { ZodType } from "zod";
import { estimateCostUsd } from "./pricing";
import type { ChatRequest, ChatResult, LlmClient } from "./types";

export type LlmErrorKind = "http" | "refused" | "empty" | "parse";

export class LlmError extends Error {
  constructor(
    public readonly kind: LlmErrorKind,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "LlmError";
  }
}

export interface OpenAiCompatibleOptions {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  /** Header that carries the provider's request id, if any. */
  requestIdHeader?: string | null;
  /** Per-request timeout; SERV multipath + shadow agent can take 40–60 s. */
  timeoutMs?: number;
}

export const DEFAULT_LLM_TIMEOUT_MS = 120_000;

interface OpenAiChatResponse {
  model?: string;
  choices?: { message?: { content?: string | null; refusal?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  error?: { message?: string };
}

/** Generic OpenAI-compatible chat client; SERV and Dolphin both speak this protocol. */
export class OpenAiCompatibleClient implements LlmClient {
  protected readonly apiKey: string;
  protected readonly baseUrl: string;
  protected readonly fetchImpl: typeof fetch;
  protected readonly requestIdHeader: string | null;
  protected readonly timeoutMs: number;

  constructor(opts: OpenAiCompatibleOptions & { baseUrl: string }) {
    this.apiKey = opts.apiKey;
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.requestIdHeader = opts.requestIdHeader === undefined ? null : opts.requestIdHeader;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_LLM_TIMEOUT_MS;
  }

  async chat(req: ChatRequest): Promise<ChatResult> {
    const body: Record<string, unknown> = {
      model: req.model,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.user },
      ],
    };
    if (req.jsonSchema) {
      body.response_format = { type: "json_schema", json_schema: { name: req.jsonSchema.name, strict: true, schema: req.jsonSchema.schema } };
    } else if (req.jsonObject) {
      body.response_format = { type: "json_object" };
    }
    if (req.tools?.length) body.tools = req.tools;
    if (req.maxTokens !== undefined) {
      // OpenAI reasoning models reject the legacy max_tokens field (confirmed by the SERV live smoke).
      body[/^(gpt-[56]|o[1-9])/.test(req.model) ? "max_completion_tokens" : "max_tokens"] = req.maxTokens;
    }
    if (req.temperature !== undefined) body.temperature = req.temperature;

    const t0 = Date.now();
    const res = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const durationMs = Date.now() - t0;
    const json = (await res.json().catch(() => ({}))) as OpenAiChatResponse;
    if (!res.ok) {
      throw new LlmError("http", json.error?.message ?? `HTTP ${res.status}`, res.status);
    }
    const msg = json.choices?.[0]?.message ?? {};
    const content = msg.content ?? null;
    const refusal = typeof msg.refusal === "string" ? msg.refusal : null;
    const usage = { promptTokens: json.usage?.prompt_tokens ?? 0, completionTokens: json.usage?.completion_tokens ?? 0 };
    const guardRefused = content === null && refusal !== null && (json.usage?.total_tokens ?? 0) === 0;
    const model = json.model ?? req.model;
    return {
      content,
      refusal,
      guardRefused,
      usage,
      requestId: this.requestIdHeader ? res.headers.get(this.requestIdHeader) : null,
      durationMs,
      model,
      costUsd: estimateCostUsd(model, usage) ?? estimateCostUsd(req.model, usage),
    };
  }
}

export class ServClient extends OpenAiCompatibleClient {
  constructor(opts: OpenAiCompatibleOptions) {
    super({
      ...opts,
      baseUrl: `${(opts.baseUrl ?? "https://inference-api.openserv.ai").replace(/\/$/, "")}/v1`,
      requestIdHeader: "x-openserv-request-id",
    });
  }
}

export function parseJsonContent<T>(res: ChatResult, schema: ZodType<T>): T {
  if (res.guardRefused) throw new LlmError("refused", res.refusal ?? "prompt guard refused");
  if (!res.content || !res.content.trim()) throw new LlmError("empty", "model returned empty content");
  const stripped = res.content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  let raw: unknown;
  try {
    raw = JSON.parse(stripped);
  } catch (e) {
    throw new LlmError("parse", `invalid JSON: ${(e as Error).message}`);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new LlmError("parse", `schema mismatch: ${parsed.error.issues[0]?.message ?? "unknown"}`);
  return parsed.data;
}
