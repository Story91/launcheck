# LaunchCheck

**Launch with the receipts.** A website-checking agent that chooses evidence within a listed-check budget, buys it through Kite Passport, and returns observations, sources and payment records.

[Application](https://tendr-ecru.vercel.app) · [Example receipt](https://tendr-ecru.vercel.app/check/fx_problems) · [Design](docs/superpowers/specs/2026-11-06-launchcheck-design.md)

Built for SERV Hackathon 02, Kite track. The earlier Tendr prototype remains at `/tendr`; its scheduled jobs are disabled. Historical Tendr evaluation figures do not describe LaunchCheck.

## What works

- Deterministic public-page checks: response, selected headers, certificate, sharing metadata/image, mail DNS and selected links.
- **OpenServ SERV Reasoning** chooses useful paid checks and explains existing findings. Code validates the catalogue, budget and evidence references. Reports record request IDs, prompt versions and input hashes. Failed model calls use a labelled rules/template fallback.
- **Kite Passport** purchases 1280px and 390px browser screenshots, an independent static HTML audit, and (Full tier) a browser session that clicks one eligible public navigation link.
- Receipts distinguish settled USDC amounts and Base transactions from quotes, refusals, unknown payments and charges without results.
- Copy an evidence-backed fix brief, check again, and inspect **Fixed X of Y**. An unperformed follow-up check does not establish a fix.
- Download receipt PNG/evidence JSON, copy a badge, and share a report link. Gallery publication is curated and restricted to our own demo pages.

Reports are unlisted and excluded from search indexing. Anyone with the link can see the submitted URL, screenshots and evidence. Avoid private data and URLs containing secrets. The creator cookie permits follow-up checks and deletion; active runs and unresolved payments must be settled before deletion.

## Prices and boundaries

| Purchased capability | Listed USD | Scope |
| --- | ---: | --- |
| Desktop screenshot | 0.005 | First screen, 1280px browser |
| Narrow screenshot | 0.005 | 390px window; not a phone emulator |
| Independent HTML audit | 0.08 | Static HTML; not Lighthouse |
| Browser navigation | 0.01 | One eligible public same-origin link; Full only |

Quick/Standard/Full allocate listed-check budgets of $0.05/$0.15/$0.25. The agent can skip services. Free checks are never purchased. Before payment we reject unsupported offers and offers above the listed price. Kite's owner-configured allowance controls settlement spending; the CLI exposes no atomic per-request price ceiling. Receipt amounts come from completed Base USDC activity. Unknown payments stop subsequent purchases in the run and trigger operator reconciliation.

SERV token estimates are separate and exclude add-on fees. They are not included in vendor USDC totals.

Screenshots establish appearance. The browser check establishes one navigation observation. LaunchCheck does not establish whole-app correctness, accessibility conformance, security, sign-in, forms, checkout or production readiness. It emits no overall score or certification. Vendor scores are dropped; third-party content is untrusted data.

The `/agents` seller interface is **planned**, not an active Base-USDC service. The old Tendr x402 seller uses a different network/asset and is not a LaunchCheck integration.

## Development

Requires Node 24 and pnpm 10.32.1.

```sh
pnpm install
cp .env.example .env
pnpm --filter @tendr/web dev
pnpm --filter @tendr/core test
pnpm --filter @tendr/web test
pnpm --filter @tendr/web typecheck
pnpm --filter @tendr/web build
```

Without a database, local reports use memory and disappear on restart. Explicitly illustrative `fx_*` reports never pay. Real execution requires Neon Postgres, `SERV_API_KEY` and owner-managed Kite configuration. Linux kpass is fetched and checksum-checked during the Vercel build. Credentials are sensitive environment values, excluded from browser bundles and exports.

| Setting | Purpose |
| --- | --- |
| `DATABASE_URL` | Durable Neon reports, evidence and ledger |
| `SERV_API_KEY`, `SERV_MODEL` | Reasoning API; default `gpt-6-luna` |
| `NEXT_PUBLIC_APP_URL` | Canonical public origin |
| `KPASS_CONFIG_JSON_B64`, `KPASS_AGENT_JSON_B64`, `KPASS_SESSIONS_JSON_B64` | Owner-managed sensitive Passport configuration |
| `LAUNCHCHECK_LIVE` | Explicit public-execution switch; `1` enables |
| `LAUNCHCHECK_LIVE_UNTIL` | Public execution expiry |
| `LAUNCHCHECK_DAILY_CAP_USD` | Daily vendor allocation cap; default `1.5` |
| `CRON_SECRET` | Owner-only fixed administrative actions |
| `LAUNCHCHECK_PROMPT_GUARD` | Optional SERV input guard; evidence validation always applies |

Public starts/reruns are rate-limited. A write-ahead payment record survives an interrupted function. The owner can reconcile unknown outcomes through read-only Kite activity at `/api/admin/launchcheck-reconcile`; it never retries a purchase. `/api/admin/launchcheck-demo` controls the first-party demo and featured receipt. These endpoints require owner authentication.

## Repository

`packages/core/src/launchcheck` contains deterministic checks, normalization, browser navigation, comparison, SERV reasoning and the pipeline. `@tendr/core/server` isolates Node-only code. `apps/web` contains Next.js UI/API, persistence and the Kite CLI adapter. `docs/coordination.md` records integration decisions.

Artifacts under `.hallmark` distinguish synthetic examples, service smoke tests and deployed end-to-end runs. Passing unit tests is not a security audit or a guarantee of third-party availability.
