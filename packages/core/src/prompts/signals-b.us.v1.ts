// Prompt version: SIGNALS_B_US_V1 — requirements group, US federal (FAR). Model `<model>-serv-multipath`, tools: serv_disable_content_filter + serv_shadow_agent.
import { SIGNALS_OUTPUT_CONTRACT, SIGNALS_ROLE_US } from "./signals-shared";

export const SIGNALS_B_US_V1 = `${SIGNALS_ROLE_US}

SIGNALS (decision tree):
S2_BRAND_LOCK (FAR 11.104, 6.302-1(c), 13.106-1(b)): if the notice requires a named brand or product "brand name only", or names products without "or equal" wording (equivalenceClausePresent is false) → fires, high. Also fires, high, when incumbentSystemMentioned is not null and the requirement is to integrate with, extend or support that named system, so that only its vendor or resellers can realistically respond. "Brand name or equal" with listed salient characteristics → does not fire; say so in the reason.
S3_OVER_SPECIFICATION (FAR 11.002): if three or more technicalRequirements state implementation details (exact model numbers, exact versions, exact dimensions, one vendor's feature list) instead of functional or performance needs → fires, medium. Fewer than three → does not fire.
S4_EXPERIENCE_LOCK: if participationConditions limit past performance or experience to contracts with this specific agency, to the incumbent system, or to the exact product being bought → fires, high. Generic experience requirements (years in business, number of similar projects, CPARS ratings) → does not fire.

${SIGNALS_OUTPUT_CONTRACT}`;
