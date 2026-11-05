# Tendr — submission write-up (draft, SERV Hackathon 02, Open Track)

**Demo:** _(link after deploy)_ · **Video:** _(link)_ · **Repo:** _(public GitHub URL)_ · **X post:** _(link)_

## What it does

Companies lose days reading solicitations before discovering the requirement is written around one supplier. Tendr reads a US federal solicitation from SAM.gov (EU notices from TED also work), evaluates eight competition-restriction signals grounded in the FAR and publishes a report where every flag cites a quote that is verified, by code, to appear verbatim in the notice. The report carries its full reasoning trail, goes to independent reviewers (Reppo) before it is called verified, and can be bought per call by an agent with a Kite Agent Passport over x402.

Data: SAM.gov publishes a public daily extract of all contract opportunities (no API key, no rate limit; downloading it is allowed by the SAM.gov Terms of Use). A daily cron streams the ~200 MB file in about 11 seconds and keeps the ~12,600 active solicitations from the last 30 days that have a description. Officials' emails and phone numbers are removed before any text reaches a model.

Real data, real decisions, auditable steps: on a live notice from the Polish central bank (3.16 M PLN) it found a required integration with a named vendor's system without an equivalence clause, in 27 seconds, for one cent.

## How it uses SERV Reasoning

- All model calls go through SERV; default model is the cheapest in the catalog (`gpt-6-luna`).
- The eight signals are three decision-tree system prompts run as `<model>-serv-multipath`; SERV compiles each into a bounded reasoning graph. Splitting the matrix into short prompts is what makes luna stable (one long prompt collapsed in 1 of 3 runs during spikes).
- `serv_shadow_agent` with a verbatim-quote hint is the difference between quotes and paraphrases: 11/12 verbatim with it, 0/14 without.
- `serv_disable_content_filter` is required because the output echoes signal labels from the system prompt; without it SERV returns "I can't share that."
- Strict `json_schema` on every call; degenerate output and prompt-guard refusals (`message.refusal`) are detected and retried once on `gpt-5.4-mini`.
- Every step stores the `x-openserv-request-id`, prompt version, tokens, cost and latency; the Audit tab links each row to the OpenServ console.

## Partners

- **Reppo Evaluation API**: each report is submitted as an `artifact` with three criteria (verbatim quotes, neutral tone, severity rules). `accept` → verified, `revise` → disputed (shown with critique), `reject` → withheld. One pending evaluation per account, so a cron worker queues submissions.
- **Kite Agent Passport / x402**: `apps/x402` wraps the report endpoint with the Kite x402 template (Pieverse facilitator, pieUSD on Kite testnet). Unverified reports answer 409, so the paywall never settles for nothing. Buyer: `kpass session execute`.
- **Dolphin**: wired as an alternative 1M-context extractor (`DOLPHIN_PRIMARY=true`); measured too slow for the default path (Day-1 results in the plan), so the default extractor is SERV `gemini-3.1-flash-lite`.

## Feedback loop in practice

The first real Reppo verdict on production (NBP notice, 4 Nov 2026) was `revise`, score 77/100: quotes verbatim and severities correct, but "slight implications of negativity in phrasing" in high-severity reasons. We turned that critique into a prompt change (signal prompts V2: reasons state what the notice says and which rule applies; the SERV shadow-agent hint now rejects effect/intent judgements). Before: "…which strongly limits potential bidders". After: "The notice says: '…integracją z Systemem DarkTrace' and the rule for this signal applies when a notice names a specific brand or product." Cost moved from ~$0.010 to ~$0.013 per report because gpt-6-luna more often hands a group to the gpt-5.4-mini fallback under the stricter check.

## Does it judge correctly? A GAO-based evaluation set

We built a ground-truth set from US GAO bid-protest decisions (`packages/core/eval/gao-cases.json`, run with `pnpm --filter @tendr/core eval`). Positives are protests GAO sustained because a solicitation term restricted competition (brand-name requirements, specifications beyond the agency's needs, narrowly shaped experience criteria). Negatives are protests on unrelated grounds whose decisions quote ordinary solicitation text. The input is only the solicitation language each decision quotes, copied from the decision PDF and checked by script to occur in it verbatim; the GAO outcome is never shown to the model. Each case runs 3 times through the production analysis path; a signal counts when it fires in at least 2 of 3 runs.

| | Rules V1 | Rules V2 | Current rules |
|---|---|---|---|
| Precision | 50% | 100% | 100% (2 of 2 flags correct) |
| Recall | 17% | 50% | 33% |
| Sustained protests caught | 1 of 6 | 3 of 6 | 2 of 6 |
| Clean solicitations flagged | 1 of 7 | 0 of 7 | 0 of 7 |
| Run-to-run stability | 90% | 92% | 97% |
| Cost of the whole run | $0.07 | $0.08 | $0.09 |

V1 flagged an agency's own information system (REMIS) as a brand and missed a task order for a named commercial product's maintenance (AtHoc). V2 stated the FAR distinction: an agency-owned system is not a brand; buying or supporting a named commercial product is. The current rules came from the first live SAM.gov reports: a NASA notice saying "THIS IS A BRAND NAME REQUIREMENT ... AUTHORIZED RESELLERS ONLY" scored 0, because the brand rule only looked at extracted product names and the verbatim check rejected the three-letter brand "HID". Now an explicit brand-name statement fires the signal, upper-case acronyms of 2–3 letters pass the verbatim check as whole words, government systems, networks and certifications are set aside before the brand rule runs, and combined synopsis/solicitations for commercial items only need a reasonable response time (FAR 12.603). The trade-off shows in the table: no false alarms and steadier runs, one borderline over-specification case (a tank-capacity cap) lost. All rule changes were made while looking at this set, so these numbers are not a held-out measurement. The remaining misses are honest limits of a text-only reader: GAO sustained them because the agency could not justify a requirement (a tank cap, a feeder capability, an exact labor-category match), which the solicitation text alone does not reveal. Tendr reports signals visible in the text; it does not claim to judge the agency's needs. Full per-case results: `packages/core/eval/results/`.

## Track

Open Track.

## Revenue

Per-report x402 sales to agents (no account needed), subscriptions for small businesses bidding in a NAICS range, licences for newsrooms and NGOs. Cost of goods is about $0.01 per report.

## Limitations

- Stability on gpt-6-luna: in 10 live runs on the same notice, 9 produced the same verdict (30/100, named-brand high + no-lots low); 1 missed the brand signal (5/100). Reports are therefore sold only after independent review, and a report whose signal groups failed is marked partial and never sold.

- Reports read the notice text (SAM.gov description or TED notice); attachments such as the PWS or specifications are not fetched yet, and many restrictive terms live there.
- The evaluation set is small (13 cases) and the rules were adjusted while looking at it.
- EU: Poland first; other member states work best-effort with a reduced-confidence note.
- Reppo verdicts are public on the Reppo feed; reports are public anyway.
- Signals are heuristics under the FAR (US) or Directive 2014/24/EU (EU). The product says "competition-restriction signals", never "rigged". Small-business set-asides are lawful and never flagged.
- Tendr is not affiliated with GSA, SAM.gov or any government agency.
