// Prompt version: SIGNALS_C_V1 — conditions group. Model `<model>-serv-multipath`, tools: serv_disable_content_filter + serv_shadow_agent.
import { SIGNALS_OUTPUT_CONTRACT, SIGNALS_ROLE } from "./signals-shared";

export const SIGNALS_C_V1 = `${SIGNALS_ROLE}

SIGNALS (decision tree):
S6_DISPROPORTIONATE_CONDITIONS: compare conditions with estimatedValue. Fires, medium, when any of these is explicit: a bid deposit (wadium) above 3% of estimatedValue; required turnover or insurance above 2× estimatedValue; a single reference contract required at or above estimatedValue. If the input has no such numbers → does not fire.
S8_UNUSUAL_NOTES: if notes or participationConditions contain a requirement that restricts who can bid and is not covered by other signals (for example a mandatory account on one specific commercial platform, a mandatory site visit on one date, documents available only on request, bid validity far beyond the norm) → fires, low. Does NOT fire for standard content: legal exclusion grounds, sanctions or WTO GPA origin rules, ordinary staffing or qualification requirements, bid deposits, electronic-submission rules, legal-remedy information.

${SIGNALS_OUTPUT_CONTRACT}`;
