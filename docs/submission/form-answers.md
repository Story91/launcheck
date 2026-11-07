# LaunCheck — draft answers for the submission form (owner review required)

Form: https://openserv.typeform.com/submissions02 · deadline 15 Nov 2026, 23:59 UTC.
These are drafts in English for the owner to read, adjust and paste. Nothing here has been submitted. Every number links to a recorded report.

## Project name
LaunCheck

## One-line description
An AI agent with a Kite Passport buys website checks from paid x402 services, inside a budget you set, and returns findings with evidence and an itemised receipt.

## Links
- Live app: https://launcheck.xyz
- Code (public): https://github.com/Story91/launcheck
- Video: attach `docs/submission/video/launcheck-v2/launcheck-v2-16x9.mp4` or link the X post that carries the 9:16 version
- X post: `<paste the URL after publishing>`
- Example reports: https://launcheck.xyz/check/lc_9b00787167ca2371f7ac07a3 (before) · https://launcheck.xyz/check/lc_KpScNuw45vmP (after fixes)

## Track
Kite

## What it does (write-up)
Before a launch, builders paste a link and hope. LaunCheck runs free checks on the public page (headers, TLS, share tags, link preview image, email DNS, the first links) on our server. Then an agent decides which paid checks are worth buying for that page: desktop and phone renders, a real browser session, an HTML audit. It pays each provider over x402 in USDC on Base through Kite Passport, inside the owner's allowance and a per-run budget.

The report keeps three things apart: what was observed (with the screenshot, header or response as evidence), what we suggest, and what we could not check. Every purchase is a receipt line with the quoted price, the amount paid and a transaction link. The owner can fix the page and run the check again; the report then shows what changed. For a fix, the user gets a handoff pack for their own coding agent; LaunCheck never edits the site.

Recorded demo: the broken page produced 10 findings for 0.015 USDC in paid checks. After fixes, the follow-up run (0.020 USDC) showed 6 of the 10 resolved. SERV inference costs are separate from those vendor charges.

## How it uses SERV Reasoning
SERV makes the two judgement calls in each run:
1. **Purchase plan.** Given the free-check results, the candidate paid checks and the budget, SERV chooses which checks to buy and why. The code then enforces the catalogue and the budget, so SERV cannot buy something outside the list or above the limit.
2. **Explanations.** For each finding that our rules detected, SERV writes the explanation and a suggested fix using only the evidence attached to that finding. SERV cannot add findings or change their severity, and an explanation that cites evidence the finding does not have is discarded.

How we call it: system prompts are fixed and versioned (`launchcheck-plan.v2`, `launchcheck-explain.v3`) so SERV can reuse its graph; the page data goes in the user message and is treated as untrusted. We request strict `json_schema` output and validate it with Zod. Each call uses `serv_shadow_agent` (told to reject invented evidence, checks outside the catalogue and claims beyond the budget) and `serv_disable_content_filter`; `serv_prompt_guard` is available behind a flag. Model: `gpt-6-luna`. Every call's `x-openserv-request-id`, input hash, model and cost goes into the report's audit trail.

## How it uses Kite
The agent has a Kite Passport identity and spends only from the owner's allowance (weekly limit), with a further daily cap and per-run budget on our side. Paid checks are x402 services on Base paid in USDC through the `kpass` CLI, which runs inside a Vercel function. Each settled payment is written to the receipt with its transaction hash; a payment whose outcome is unknown is labelled, never retried blindly.

## What was built during the hackathon
We started on a different idea (Tendr, procurement notices) and pivoted on 6 Nov 2026. Built during the event: the LaunCheck engine (free checks with an SSRF guard, paid-check catalogue, SERV planning and explanations), Kite Passport payments from a serverless function, receipts and audit trail, Postgres persistence, re-check with before/after comparison, the fix handoff pack, the link-preview tool and the public app. Tendr remains archived in the repo.

## Revenue potential
Per-run pricing on top of the paid checks (quick, standard, full), for founders and small teams before a launch and for agencies checking client pages. A second channel is selling LaunCheck itself as an x402 service so other agents can buy a check; this is planned and not live yet.

## Limits we state openly
One public page per run; no sign-in, forms or checkout flows; no claim of full accessibility or security testing. Findings come from rules and recorded evidence; AI explanations are constrained but can still be wrong, so fixes need human review. Live runs are funded until 15 Nov 2026, 23:59 UTC; recorded reports stay viewable after that.
