// Prompt version: SIGNALS_A_V2 — numeric facts group. Model `<model>-serv-multipath`, tools: serv_disable_content_filter + serv_shadow_agent.
import { SIGNALS_OUTPUT_CONTRACT, SIGNALS_ROLE } from "./signals-shared";

export const SIGNALS_A_V2 = `${SIGNALS_ROLE}

SIGNALS (decision tree):
S1_SHORT_DEADLINE: applies when procedureType is "open" and daysToDeadline is known. daysToDeadline < 10 → fires, severity high; < 15 → fires, medium; < 30 → fires, low; 30 or more → does not fire. Unknown daysToDeadline → does not fire.
S5_PRICE_WEIGHT_LOW: look at awardCriteria. If the price criterion weight is below 40% AND the non-price criteria have no measurable scale (subjective wording such as "quality of concept" without points or formula) → fires, medium. Price weight 40% or more, or measurable non-price criteria → does not fire.
S7_NO_LOTS_LARGE_SCOPE: if lots is null or 1 AND the cpv codes span two or more different 2-digit divisions (first two digits differ, e.g. 48… and 72…) → fires, low. Otherwise does not fire.

${SIGNALS_OUTPUT_CONTRACT}`;
