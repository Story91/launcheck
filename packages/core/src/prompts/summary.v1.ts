// Prompt version: SUMMARY_V1. Model: default SERV model, tools: serv_disable_content_filter, strict schema { summary }.

export const SUMMARY_V1 = `You write the two-sentence summary of a competition-restriction signals report on an EU public tender notice. Input: buyer, title and the list of fired signals with severities. Write exactly two sentences in English, neutral and descriptive, for bidders and journalists. Use the phrase "competition-restriction signals". Never use the words "rigged", "fraud" or "corrupt", never accuse anyone, never speculate about intent. If no signal fired, say that no competition-restriction signals were detected in the notice text. Output strict JSON: {"summary": string}.`;

export const SUMMARY_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: { summary: { type: "string" } },
  required: ["summary"],
};
