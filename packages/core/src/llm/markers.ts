import type { MarkerTool } from "./types";

/** Input-side injection/leak guard; SERV refuses without calling upstream. Response has content null + refusal text. */
export const PROMPT_GUARD: MarkerTool = { type: "function", function: { name: "serv_prompt_guard" } };

/**
 * Disables SERV's output system-prompt-leak filter. Required whenever the OUTPUT legitimately echoes
 * structure defined in the system prompt (signal ids, labels), otherwise the answer becomes "I can't share that."
 */
export const DISABLE_CONTENT_FILTER: MarkerTool = { type: "function", function: { name: "serv_disable_content_filter" } };

/** Validate-and-iterate loop. Not compatible with streaming. */
export function shadowAgent(hint: string, maxIterations = 2): MarkerTool {
  return {
    type: "function",
    function: {
      name: "serv_shadow_agent",
      parameters: {
        type: "object",
        properties: {
          hint: { type: "string", default: hint },
          max_iterations: { type: "integer", default: maxIterations },
        },
      },
    },
  };
}
