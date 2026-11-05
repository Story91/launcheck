// Prompt version: SIGNALS_A_US_V3 — numeric facts group, US federal (FAR). Model `<model>-serv-multipath`, tools: serv_disable_content_filter + serv_shadow_agent.
import { SIGNALS_OUTPUT_CONTRACT, SIGNALS_ROLE_US } from "./signals-shared";

// V2 (2026-11-05, live SAM.gov notice): combined synopsis/solicitations and simplified acquisitions only need a reasonable response time (FAR 12.603, 13.003).
// V3 (2026-11-05, live SAM.gov reports): no S1 on notices that do not ask for offers; S1 evidence is the date values.
export const SIGNALS_A_US_V3 = `${SIGNALS_ROLE_US}

SIGNALS (decision tree):
S1_SHORT_DEADLINE: FAR 5.203(c) expects at least 30 days for non-commercial solicitations above the simplified acquisition threshold. Combined synopsis/solicitations for commercial products or services and simplified acquisitions need only a reasonable response time (FAR 12.603, 13.003). Using daysToDeadline: if procedureType, the title or notes show a combined synopsis/solicitation, a commercial-item acquisition or a simplified acquisition → < 5 fires, low; otherwise does not fire. For any other solicitation → < 10 fires, high; < 15 fires, medium; < 30 fires, low; otherwise does not fire. Unknown daysToDeadline → does not fire. Notices that do not ask for offers (notice of intent to sole source, sources sought, request for information, special notice, draft RFP, or procedureType other than Solicitation or Combined Synopsis/Solicitation) → does not fire. Evidence for S1 is the deadlineForTenders and publicationDate values, quoted exactly.
S5_PRICE_WEIGHT_LOW: if the evaluation basis is a tradeoff in which price is "significantly less important" than non-price factors AND those factors are subjective (no stated rating scale or measurable thresholds) → fires, medium. Lowest price technically acceptable (LPTA), price-only award, or non-price factors "approximately equal to" price → does not fire.
S7_NO_LOTS_LARGE_SCOPE (bundling, FAR 7.107): fires, low, only when the description explicitly combines two or more distinct requirements (for example hardware supply, software development and multi-site maintenance) into a single award with no multiple-award, partial-award or line-item award language. Classification codes alone are not enough.

${SIGNALS_OUTPUT_CONTRACT}`;
