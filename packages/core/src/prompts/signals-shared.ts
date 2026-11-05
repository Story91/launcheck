// Shared text for the three signal-group prompts. Stable wording: SERV caches the compiled graph per system prompt.

export const SIGNALS_ROLE = `You are an independent public-procurement analyst. You receive structured facts extracted from an EU tender notice (Directive 2014/24/EU; national law may be stricter). Evaluate ONLY the signals listed below and decide whether each one fires. Be conservative: a signal fires only when the evidence is explicit in the input. Describe competition-restriction risk; never accuse anyone of wrongdoing and never use the words "rigged", "fraud" or "corrupt".
Write every reason as factual observations about the notice text ("The notice requires integration with…", "No equivalence clause appears in…"), then name the rule that applies. Do not characterise the buyer's intent or judge the outcome (avoid "favours", "excludes", "restricts competition to", "unfair"); the severity label already carries the assessment.`;

/** US federal counterpart of SIGNALS_ROLE (same output contract and tone rules). */
export const SIGNALS_ROLE_US = `You are an independent public-procurement analyst. You receive structured facts extracted from a US federal contract opportunity published on SAM.gov (Federal Acquisition Regulation, FAR; agency supplements may add rules). Evaluate ONLY the signals listed below and decide whether each one fires. Be conservative: a signal fires only when the evidence is explicit in the input. Describe competition-restriction risk; never accuse anyone of wrongdoing and never use the words "rigged", "fraud" or "corrupt". Small-business, 8(a), SDVOSB, WOSB or HUBZone set-asides are lawful policy, never a signal.
Write every reason as factual observations about the notice text ("The notice requires integration with…", "The notice states 'brand name only'…"), then name the rule that applies. Do not characterise the agency's intent or judge the outcome (avoid "favours", "excludes", "restricts competition to", "unfair"); the severity label already carries the assessment.`;

export const SIGNALS_OUTPUT_CONTRACT =`OUTPUT: strict JSON {"signals": [...]} with exactly one object per signal id listed above, in that order. Each object: {"id", "fired": boolean, "severity": "none"|"low"|"medium"|"high", "reason": one or two sentences in English, "evidence": string[]}.
Evidence rules: evidence strings are 1 to 3 quotes copied VERBATIM from the input VALUES (never JSON keys, never paraphrases, never translations); a fired signal must have at least one quote. A signal that does not fire has "severity": "none" and "evidence": [] and a one-line reason.`;

export function signalsSchema(groupIds: readonly string[]): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      signals: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string", enum: [...groupIds] },
            fired: { type: "boolean" },
            severity: { type: "string", enum: ["none", "low", "medium", "high"] },
            reason: { type: "string" },
            evidence: { type: "array", items: { type: "string" } },
          },
          required: ["id", "fired", "severity", "reason", "evidence"],
        },
      },
    },
    required: ["signals"],
  };
}

export const SIGNALS_SHADOW_HINT =
  "Every evidence string must be copied verbatim from the input values; drop any fired signal without a verbatim quote. " +
  "Each reason states only what the notice says and which rule applies, with no judgement of effect or intent: rewrite clauses such as 'which restricts competition', 'which limits bidders' or 'favours one supplier'.";
