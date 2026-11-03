import { OpenAiCompatibleClient, type OpenAiCompatibleOptions } from "./serv";
import type { ChatRequest, ChatResult } from "./types";

export const DOLPHIN_BASE_URL = "https://lighthouse.dphn.ai/run/text-v/v1";
export const DOLPHIN_DEFAULT_MODEL = "deepseek-ai/DeepSeek-V4.1-Flash";
const DEFAULT_MAX_TOKENS = 3000;

/** Dolphin network API: OpenAI-compatible, only /chat/completions and /models; no request id header. */
export class DolphinClient extends OpenAiCompatibleClient {
  constructor(opts: OpenAiCompatibleOptions) {
    super({ ...opts, baseUrl: opts.baseUrl ?? DOLPHIN_BASE_URL, requestIdHeader: null });
  }

  override chat(req: ChatRequest): Promise<ChatResult> {
    return super.chat({ ...req, maxTokens: req.maxTokens ?? DEFAULT_MAX_TOKENS });
  }
}
