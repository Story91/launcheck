// Prompt version: EXTRACT_V1. Used with Dolphin (json_object) and, as fallback, SERV (json_schema + serv_disable_content_filter).
// Keep the text stable: SERV caches the compiled reasoning graph per system prompt for 30 days.

export const EXTRACT_V1 = `You extract procurement facts from a public tender notice (EU eForms, flattened to "Tag: text" lines). Output strict JSON only, with exactly these fields:
{
 "buyer": string, "title": string, "cpv": string[], "estimatedValue": string|null, "currency": string|null,
 "deadlineForTenders": string|null, "publicationDate": string|null, "daysToDeadline": integer|null,
 "procedureType": string|null, "lots": integer|null,
 "awardCriteria": [{"name": string, "weight": string|null}],
 "participationConditions": string[],      // verbatim, one condition per item
 "technicalRequirements": string[],        // verbatim requirements that could narrow the field of bidders
 "brandOrProductNames": string[],          // any named brands/products/vendors/standards that appear in requirements
 "equivalenceClausePresent": boolean,      // true only if the text explicitly allows equivalent solutions ("lub równoważny", "or equivalent")
 "incumbentSystemMentioned": string|null,  // name of an already-installed system the new one must integrate with, verbatim, else null
 "contractDuration": string|null,
 "notes": string[],                        // anything unusual that could restrict who can bid, verbatim
 "noticeLanguage": string                  // ISO 639-2 code given in the user message
}
Rules: copy text verbatim from the source, never paraphrase inside string arrays; never invent values, use null when absent; daysToDeadline = calendar days between publicationDate and deadlineForTenders; keep each array item under 600 characters.`;

export const EXTRACT_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    buyer: { type: "string" },
    title: { type: "string" },
    cpv: { type: "array", items: { type: "string" } },
    estimatedValue: { type: ["string", "null"] },
    currency: { type: ["string", "null"] },
    deadlineForTenders: { type: ["string", "null"] },
    publicationDate: { type: ["string", "null"] },
    daysToDeadline: { type: ["integer", "null"] },
    procedureType: { type: ["string", "null"] },
    lots: { type: ["integer", "null"] },
    awardCriteria: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { name: { type: "string" }, weight: { type: ["string", "null"] } },
        required: ["name", "weight"],
      },
    },
    participationConditions: { type: "array", items: { type: "string" } },
    technicalRequirements: { type: "array", items: { type: "string" } },
    brandOrProductNames: { type: "array", items: { type: "string" } },
    equivalenceClausePresent: { type: "boolean" },
    incumbentSystemMentioned: { type: ["string", "null"] },
    contractDuration: { type: ["string", "null"] },
    notes: { type: "array", items: { type: "string" } },
    noticeLanguage: { type: "string" },
  },
  required: [
    "buyer", "title", "cpv", "estimatedValue", "currency", "deadlineForTenders", "publicationDate", "daysToDeadline",
    "procedureType", "lots", "awardCriteria", "participationConditions", "technicalRequirements", "brandOrProductNames",
    "equivalenceClausePresent", "incumbentSystemMentioned", "contractDuration", "notes", "noticeLanguage",
  ],
};
