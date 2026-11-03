import type { TokenUsage } from "./types";

/** $ per million tokens [input, output]. Source: docs/research/01-serv-reasoning.md, 02-dolphin.md (Nov 2026). */
const PRICES: Record<string, [number, number]> = {
  "gpt-6-luna": [0.13, 0.65],
  "gpt-5.4-nano": [0.25, 1.6],
  "gpt-5.4-mini": [1.0, 6.0],
  "gemini-3.1-flash-lite": [0.3, 1.8],
  "deepseek-ai/DeepSeek-V4.1-Flash": [0.01, 0.07],
};

/** Matches on prefix so SERV suffixes (`-serv-multipath`, `-serv-kronos`) resolve to the base model. */
export function estimateCostUsd(model: string, usage: TokenUsage): number | null {
  const key = Object.keys(PRICES)
    .filter((k) => model.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  if (!key) return null;
  const [inPrice, outPrice] = PRICES[key]!;
  return (usage.promptTokens * inPrice + usage.completionTokens * outPrice) / 1e6;
}
