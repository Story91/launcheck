// Prompt version: EXTRACT_V2 (V1 + US federal notices). Used with Dolphin (json_object) and SERV (json_schema + serv_prompt_guard / serv_disable_content_filter).
// Keep the text stable: SERV caches the compiled reasoning graph per system prompt for 30 days. Jurisdiction comes in the user message.

export const EXTRACT_V2 = `You extract procurement facts from a public tender notice flattened to "field: text" lines: either an EU notice from TED (eForms) or a US federal contract opportunity from SAM.gov (metadata plus the description). The user message states the jurisdiction. Output strict JSON only, with exactly these fields:
{
 "buyer": string,                          // contracting authority or agency office
 "title": string, "cpv": string[],         // classification codes: CPV (EU) or NAICS and PSC/classificationCode (US)
 "estimatedValue": string|null, "currency": string|null,
 "deadlineForTenders": string|null, "publicationDate": string|null, "daysToDeadline": integer|null,
 "procedureType": string|null, "lots": integer|null,
 "awardCriteria": [{"name": string, "weight": string|null}],
 "participationConditions": string[],      // verbatim, one condition per item
 "technicalRequirements": string[],        // verbatim requirements that could narrow the field of bidders
 "brandOrProductNames": string[],          // any named brands/products/vendors/standards that appear in requirements
 "equivalenceClausePresent": boolean,      // true only if the text explicitly allows equivalent solutions ("lub równoważny", "or equivalent", "brand name or equal"); "brand name only" means false
 "incumbentSystemMentioned": string|null,  // name of an already-installed system the new one must integrate with, verbatim, else null
 "contractDuration": string|null,
 "notes": string[],                        // anything unusual that could restrict who can bid, verbatim
 "noticeLanguage": string                  // ISO 639-2 code given in the user message
}
Rules: copy text verbatim from the source, never paraphrase inside string arrays; never invent values, use null when absent; daysToDeadline = calendar days between publicationDate (US: postedDate) and deadlineForTenders (US: responseDeadLine); for US notices put evaluation factors (price, technical, past performance, tradeoff or LPTA wording) into awardCriteria and offeror eligibility, past-performance and experience requirements into participationConditions; a set-aside type is a fact for notes, not a restriction; keep each array item under 600 characters.`;

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
