# Tendr — submission write-up (draft, SERV Hackathon 02, Open Track)

**Demo:** _(link after deploy)_ · **Video:** _(link)_ · **Repo:** _(public GitHub URL)_ · **X post:** _(link)_

## What it does

Companies lose days reading 300-page tender documentation before discovering the tender is written around one supplier. Tendr reads a TED notice (EU public procurement), evaluates eight competition-restriction signals and publishes a report where every flag cites a quote that is verified, by code, to appear verbatim in the notice. The report carries its full reasoning trail, goes to independent reviewers (Reppo) before it is called verified, and can be bought per call by an agent with a Kite Agent Passport over x402.

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

## Track

Open Track.

## Revenue

Per-report x402 sales to agents (no account needed), subscriptions for SMEs bidding in a CPV range, licences for newsrooms and NGOs. Cost of goods is about $0.01 per report.

## Limitations

- Stability on gpt-6-luna: in 10 live runs on the same notice, 9 produced the same verdict (30/100, named-brand high + no-lots low); 1 missed the brand signal (5/100). Reports are therefore sold only after independent review, and a report whose signal groups failed is marked partial and never sold.

- Reports use the TED notice; full tender documentation on buyer platforms is not fetched yet.
- Poland first; other member states work best-effort with a reduced-confidence note.
- Reppo verdicts are public on the Reppo feed; reports are public anyway.
- Signals are heuristics under Directive 2014/24/EU. The product says "competition-restriction signals", never "rigged".
