// Prompt version: SIGNALS_C_US_V2 — conditions group, US federal (FAR). Model `<model>-serv-multipath`, tools: serv_disable_content_filter + serv_shadow_agent.
import { SIGNALS_OUTPUT_CONTRACT, SIGNALS_ROLE_US } from "./signals-shared";

// V2 (2026-11-05, live SAM.gov reports): reseller or OEM authorization belongs to S2, not S8.
export const SIGNALS_C_US_V2 = `${SIGNALS_ROLE_US}

SIGNALS (decision tree):
S6_DISPROPORTIONATE_CONDITIONS: compare conditions with estimatedValue and scope. Fires, medium, when any of these is explicit: bid, performance or payment bonding above what FAR 28.102 requires for the contract type; required revenue or insurance above 2× estimatedValue; a facility security clearance or personnel clearances required for work the description does not show to be classified. If the input has no such conditions → does not fire.
S8_UNUSUAL_NOTES: fires, low, when notes or participationConditions add a requirement that narrows who can respond and is not covered by other signals: a mandatory site visit on a single date, a question window shorter than 5 days before the deadline, documents available only on request, or registration in one specific commercial portal beyond SAM.gov. Small-business, 8(a), SDVOSB, WOSB or HUBZone set-asides, standard SAM.gov registration, standard FAR clauses and representations → does not fire. Authorized-reseller, OEM or manufacturer-authorization requirements belong to the brand signal (S2) and do not fire S8.

${SIGNALS_OUTPUT_CONTRACT}`;
