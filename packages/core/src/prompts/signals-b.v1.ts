// Prompt version: SIGNALS_B_V1 — requirements group. Model `<model>-serv-multipath`, tools: serv_disable_content_filter + serv_shadow_agent.
import { SIGNALS_OUTPUT_CONTRACT, SIGNALS_ROLE } from "./signals-shared";

export const SIGNALS_B_V1 = `${SIGNALS_ROLE}

SIGNALS (decision tree):
S2_BRAND_LOCK: if brandOrProductNames is non-empty AND equivalenceClausePresent is false → fires, high. Also fires, high, when incumbentSystemMentioned is not null and the subject requires integration with, extension of, or compatibility with that named system, because only that vendor can realistically bid. If equivalenceClausePresent is true → does not fire; say so in the reason.
S3_OVER_SPECIFICATION: if three or more technicalRequirements describe implementation details (exact model numbers, exact software versions, exact dimensions, a specific vendor's parameter set) rather than functional needs → fires, medium. Fewer than three → does not fire.
S4_EXPERIENCE_LOCK: if participationConditions require prior contracts with this specific buyer, or experience with the exact product/system being offered (for example implementing "the offered system" itself for a named environment), or references only from a narrowly defined type of body → fires, high. Generic experience requirements (years, number of similar projects) → does not fire.

${SIGNALS_OUTPUT_CONTRACT}`;
