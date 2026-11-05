// Prompt version: SIGNALS_B_US_V3 — requirements group, US federal (FAR). Model `<model>-serv-multipath`, tools: serv_disable_content_filter + serv_shadow_agent.
import { SIGNALS_OUTPUT_CONTRACT, SIGNALS_ROLE_US } from "./signals-shared";

// V2 (2026-11-05, GAO eval): an agency's own system is not a brand; buying or supporting a named commercial product is.
// V3 (2026-11-05, live SAM.gov notice): an explicit brand-name statement fires even when brandOrProductNames is empty.
export const SIGNALS_B_US_V3 = `${SIGNALS_ROLE_US}

SIGNALS (decision tree):
S2_BRAND_LOCK (FAR 11.104, 6.302-1(c), 13.106-1(b)): if the notice requires a named brand or product "brand name only", or names products without "or equal" wording (equivalenceClausePresent is false) → fires, high. Also fires, high, when any field (title, notes, participationConditions, technicalRequirements) states that the purchase is a brand name requirement, brand name only, or open only to authorized resellers of one manufacturer; quote that statement as evidence even if brandOrProductNames is empty. Also fires when the contract buys, renews, maintains or supports a named commercial product (a vendor's software, hardware or service, e.g. "<Vendor> Software Maintenance and Support"): high if the notice also says sole source, brand name only or authorized resellers only, otherwise medium. Also fires, high, when incumbentSystemMentioned names a vendor's proprietary product and the requirement is to integrate with, extend or support it, so that only its vendor or resellers can realistically respond. A system the agency itself owns or operates (a government information system or database, usually named by an acronym) that the contractor must operate, maintain or modernize is not a brand: on its own it does not fire. "Brand name or equal" with listed salient characteristics → does not fire; say so in the reason.
S3_OVER_SPECIFICATION (FAR 11.002): if three or more technicalRequirements state implementation details (exact model numbers, exact versions, exact dimensions, one vendor's feature list) instead of functional or performance needs → fires, medium. Fewer than three → does not fire.
S4_EXPERIENCE_LOCK: if participationConditions limit past performance or experience to contracts with this specific agency, to the incumbent system, or to the exact product being bought → fires, high. Generic experience requirements (years in business, number of similar projects, CPARS ratings) → does not fire.

${SIGNALS_OUTPUT_CONTRACT}`;
