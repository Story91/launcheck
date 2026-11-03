export interface MarkerTool {
  type: "function";
  function: { name: string; parameters?: Record<string, unknown> };
}

export interface ChatRequest {
  model: string;
  system: string;
  user: string;
  /** Strict JSON schema output (OpenAI `response_format: json_schema`). */
  jsonSchema?: { name: string; schema: Record<string, unknown> };
  /** Loose JSON mode (`response_format: json_object`) for providers without schema support. */
  jsonObject?: boolean;
  tools?: MarkerTool[];
  maxTokens?: number;
  temperature?: number;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface ChatResult {
  content: string | null;
  refusal: string | null;
  /** True when a SERV prompt guard refused before any upstream call (content null, refusal text, zero usage). */
  guardRefused: boolean;
  usage: TokenUsage;
  requestId: string | null;
  durationMs: number;
  model: string;
  costUsd: number | null;
}

export interface LlmClient {
  chat(req: ChatRequest): Promise<ChatResult>;
}
