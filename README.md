# Tendr

Competition-restriction signal reports for EU public tenders, with verbatim quotes, a full reasoning audit trail, independent verification and per-call sales to agents.

Built for [SERV Hackathon 02](https://www.openserv.ai/hackathon-2) (OpenServ, 2–15 November 2026), Open Track.

## What it does

1. You give it a TED publication number (or pick one of the recent Polish IT notices on the home page).
2. It downloads the eForms XML from TED, extracts the facts (buyer, value, deadline, criteria, conditions, named products) and evaluates **eight competition-restriction signals**: short deadline, named brand or incumbent system, over-specification, experience tied to one supplier, low price weight with subjective criteria, disproportionate financial conditions, no lots across a broad scope, unusual organisational requirements.
3. Every signal that fires must cite a quote that the code verifies **verbatim against the notice text** (never against model output). Quotes that are not in the notice are dropped and the signal is unfired; extracted facts are filtered the same way before the signal step sees them.
4. The report is published immediately as *pending independent verification*, then sent to **Reppo's Evaluation API**; the verdict becomes *verified*, *disputed* or *withheld*.
5. Verified reports are sold per call over **x402** on the Kite network; an agent with a **Kite Agent Passport** buys one inside the spending limits its owner approved.

Reports describe signals in the notice text. They never claim wrongdoing.

## How it uses SERV Reasoning

Every model call goes through `https://inference-api.openserv.ai` (default model `gpt-6-luna`):

- **Signal matrix as three `-serv-multipath` calls.** Each group of signals is a decision tree in a stable system prompt that SERV compiles into a bounded reasoning graph (cached 30 days per prompt). Splitting eight signals into three short prompts keeps the cheapest model stable.
- **`serv_shadow_agent`** with the hint *"every evidence string must be copied verbatim from the input values"* is what makes the quotes verbatim; without it the model paraphrases.
- **`serv_disable_content_filter`** because the output legitimately echoes labels defined in the system prompt.
- **Strict `json_schema` output** on every call, validated again with Zod.
- **Audit trail**: each step records model, prompt version, the `x-openserv-request-id` header (links to the OpenServ console), tokens, cost and latency. A report costs about $0.01.
- Degenerate output (all signals "none" with identical reasons) and prompt-guard refusals are detected and retried once on `gpt-5.4-mini`.

Dolphin (DeepSeek V4.1 Flash, 1M context) is wired as an alternative extractor (`DOLPHIN_PRIMARY=true`); by default extraction runs on SERV `gemini-3.1-flash-lite` (see `docs/superpowers/plans/2026-11-03-tendr.md`, "Day-1 results").

## Repository

```
packages/core   pipeline: TED client, flattener, SERV/Dolphin clients, prompts, signals, verification, scoring, Reppo
apps/web        Next.js app (Vercel): home, report page with live progress, audit tab, API, Reppo cron worker
apps/x402       Express service from the Kite x402 template: GET /v1/report/{noticeId} behind a 402 paywall
vercel.json     one Vercel project with two services (web + x402), /v1 and /healthz routed to x402, cron for Reppo
docs/           research, spec, plan, submission materials
```

## Quick start

```bash
pnpm install
cp .env.example .env        # fill SERV_API_KEY at minimum
pnpm test                   # 102 unit tests, no network
pnpm --filter @tendr/core test:live   # one real run against TED + SERV
pnpm --filter @tendr/web dev           # http://localhost:3000 (in-memory store without DATABASE_URL)
```

### Environment

| Variable | Purpose |
|---|---|
| `SERV_API_KEY` | SERV Reasoning key from console.openserv.ai (required) |
| `SERV_MODEL` | default `gpt-6-luna`; `SERV_FALLBACK_MODEL` default `gpt-5.4-mini`; `SERV_EXTRACT_MODEL` default `gemini-3.1-flash-lite` |
| `DOLPHIN_API_KEY`, `DOLPHIN_PRIMARY` | optional bulk extractor (lighthouse.dphn.ai) |
| `REPPO_EVAL_API_KEY`, `REPPO_SANDBOX` | Reppo Evaluation API; sandbox=true gives free placeholder verdicts |
| `DATABASE_URL` | Neon Postgres (omit locally for an in-memory store) |
| `INTERNAL_SECRET` | shared secret between `apps/x402` and `/api/internal/report` |
| `CRON_SECRET` | protects `/api/cron/reppo` (runs every minute on Vercel) |
| `PAY_TO`, `KITE_NETWORK`, `PRICE_USD` | `apps/x402` seller configuration; the upstream comes from the Vercel service binding `WEB_INTERNAL_URL` (or `UPSTREAM_URL` when run alone) |

### Buying a report with Kite Agent Passport

```bash
kpass session create --task-summary "buy tender report" --max-amount-per-tx 1 --max-total-amount 5 --ttl 24h --assets USDC --output json
# approve with your passkey, then
kpass session execute --url https://<deployment>/v1/report/722731-2026 --method GET --output json
kpass activity --limit 5
```

Reports that are not yet verified answer `409 { status, retryAfterSeconds }` and are never charged.

## Deploy (Vercel)

Import the repository as one project (root `./`, preset *Services*); `vercel.json` declares the `web` (Next.js) and `x402` (Express) services, routes `/v1/*` and `/healthz` to x402 and everything else to web, binds `WEB_INTERNAL_URL` into x402, and schedules `/api/cron/reppo` every minute. Set the environment variables above on the project, then run `pnpm --filter @tendr/web db:push` once with `DATABASE_URL` to create the tables.

## Example

TED 722731-2026, Narodowy Bank Polski, "System wykrywania anomalii w ruchu SMTP w oparciu o Self-Learning AI", 3.16 M PLN, price 100%: risk 30/100, **named brand or incumbent system: high** ("Integracja z Systemem DarkTrace", "Microsoft Exchange"), no lots across a broad scope: low. Two SERV calls plus extraction, 27 s, $0.009.

## License

MIT for this repository. `apps/x402/src/kite.ts` is adapted from gokite-ai/kite-x402-services (Apache-2.0).
