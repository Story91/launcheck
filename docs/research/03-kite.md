# Kite AI / Agent Passport (@GoKiteAI) — research (2026-11-03)

**Track 02: "Build agents with a verifiable identity and spending limits you control, so they can shop, book, and pay on your behalf."** Docs: https://docs.gokite.ai/passport. Post Kite: "▷ Verifiable identity ▷ User-defined permissions and spending limits ▷ Agentic payments for real tasks".

## Co to jest

- Firma: dawniej Zettablock; $18M Series A (PayPal Ventures, General Catalyst); mainnet + Agent Passport od 30 IV 2026. Partnerzy: PayPal PYUSD, Google AP2, Coinbase x402, Stripe MPP, Crossmint, Privy.
- Trzy warstwy: **Kite Chain** (EVM L1, Avalanche subnet) · **Agent Passport** (tożsamość agenta + portfel + limity + passkey + audit trail) · **Agent Interface** (rejestracja, skille dla Claude Code/Codex/Cursor, katalog 2 000+ płatnych usług).
- **Hackathon dotyczy Passportu.**

## Model tożsamości (3 warstwy)

- **User** (root, passkey/hardware, może odwołać wszystko)
- **Agent** (adres pochodny BIP-32, własny portfel i reputacja; DID np. `did:kite:alice.eth/chatgpt/portfolio-manager-v1`)
- **Session** (efemeryczny klucz per zadanie)

Łańcuch autoryzacji: Standing Intent (user) → Delegation Token (agent, ~60 s) → Session Signature (per tx). Reguły wydatków on-chain (capy, okna, whitelisty) + polityki off-chain (TTL, allowlisty).

W praktyce dziś: **allowance** (cykliczny budżet, max 100 USD/okres, tylko live mode, tylko płatne API) vs **session** (budżet per zadanie: max per tx, max total, data końca; jedna aprobata passkey; obejmuje API i zakupy).

## Sieć

| | Testnet | Mainnet |
|---|---|---|
| Chain ID | **2368** (0x940) | **2366** |
| RPC | https://rpc-testnet.gokite.ai/ | https://rpc.gokite.ai/ (wss://rpc.gokite.ai/ws) |
| Explorer | https://testnet.kitescan.ai | https://kitescan.ai |
| Faucet | https://faucet.gokite.ai (KITE) | — |
| Stablecoin x402 | pieUSD `0x38129cf4CE5E183eFF248F42A7D345Bb1B47621A` (18 dec) · PYUSD testnet `0x8E04D099b1a8Dd20E6caD4b2Ab2B405B98242ec9` | USDC.e `0x7aB6f3ed87C42eF0aDb67Ed95090f8bF5240149e` (6 dec) |

**Uwaga:** od lipca 2026 domyślny chain rozliczeń Passportu to **Base USDC (8453)**, nie Kite. Passport sponsoruje gas. `kpass wallet send --chain kite` jest odrzucane.

## Developer surface = CLI, nie HTTP API

Docs wprost: "no public HTTP API reference yet". Integracja = shellowanie `kpass` / `ksearch` z `--output json`, albo skille w agentach kodujących.

Instalacja (Windows): `irm https://cli.gokite.ai/install.ps1 | iex` · (bash) `curl -fsSL https://cli.gokite.ai/install.sh | bash` · skille: `kpass skills setup --global --agent claude --yes` lub `npx skills add gokite-ai/passport-skills`.

Auth: `kpass signup init --email … --output json` → link e-mail → `kpass signup poll --signup-id … --wait` → `kpass signup exchange …`; powrót: `kpass login init` → kod OTP → `kpass login verify`. Passkey w dashboardzie https://agentpassport.ai.

Kluczowe komendy:
- `kpass status` · `kpass health` · `kpass me` · `kpass wallet balance` · `kpass wallet address`
- `kpass agent:register --type <label>` · `kpass user agents`
- `kpass session create --task-summary "…" --max-amount-per-tx 2 --max-total-amount 10 --ttl 24h --assets USDC --output json` → approval URL (passkey)
- `kpass session status --request-id <ID> --wait` (blokuje ≤5 min)
- `kpass session execute --url "<https>" --method GET|POST [--body '{}'] [--idempotency-key <uuid>] --output json` → obsługa 402 → płatność → odpowiedź
- `kpass allowance status` · `kpass activity --limit 20` (audit trail)
- `kpass sandbox on|off` · `kpass faucet drop --recipient <addr> --token pieUSD` (testnet)
- `kpass shop:search / shop:cart / shop:checkout --confirmed --max-total` (tylko Amazon)
- `kpass agent router` (inferencja płatna Passportem)
- `ksearch services list --query weather --payment-approach x402_http --asset USDC --limit 10 --output json` · `ksearch services get --service-id <ID>`

Koperta JSON: `_version`, `status` (np. `human_action_required`), `hint`, `next_command`, `user_message`. Exit codes: 0 ok, 3 auth, 4 brak allowance, 5 rate limit, **6 naruszenie polityki/budżetu (nigdy nie twórz automatycznie nowej sesji)**, 7 wynik nieznany (retry z tym samym idempotency key).

Delegation JSON (`--delegation "$JSON"`): `task.summary`, `payment_policy{max_amount_per_tx,max_total_amount,ttl_seconds,currency}`, `execution_constraints.x402.allowed_endpoints[]` (zapisywane, **niewymuszane**), `routing_enabled`, `routing_cost_cap_usd_micros`.

Testowy merchant 402: `https://passport.dev.gokite.ai/x402/test` (dokumentowany `x402.dev.gokite.ai` jest martwy).

## Strona sprzedawcy (przyjmowanie płatności x402)

- Guide: https://docs.gokite.ai/passport/seller. Flow: 402 z warunkami → agent odsyła z `X-PAYMENT` → verify + settle przez facilitator → dostawa.
- Facilitator Pieverse: `https://facilitator.pieverse.io/v2` (`POST /v2/verify`, `POST /v2/settle`, `GET /v2/supported`; obsługuje eip155:2366, 2368, 8453…).
- **Najlepszy starter:** https://github.com/gokite-ai/kite-x402-services — "Wrap any HTTP API as an x402 service paid on the Kite chain"; template `templates/typescript-express` (Node 22, Express 5, `@x402/express`); env `PAY_TO`, `KITE_NETWORK`, `UPSTREAM_URL`, `PRICE_USD`; każde `/v1/*` paywall, `/healthz` darmowe; settle tylko gdy upstream < 400. Katalog: `services/<name>/service.yaml` + PR. Merchant musi być na publicznym HTTPS (Passport dzwoni ze swoich serwerów).
- A2A: https://github.com/gokite-ai/a2a-coordination-extension (podpisane umowy buyer/seller, escrow).
- Legacy on-chain SDK: `gokite-aa-sdk` (ERC-4337 vault ze spending rules) — raczej nie używać.

## Przykłady

- Tranche (hackathon 02, Kite+Reppo): https://github.com/PhiBao/tranche — proof-gated milestone payments
- Kitedesk: https://github.com/kendacki/Kitedesk — 402 → budżet → EIP-3009 → Pieverse settle
- Oficjalne: kite_counter_dapp, kite_voting_dapp, open-meteo x402 service

## Ograniczenia / pułapki

- Sesje wymagają aprobaty passkey w przeglądarce przez człowieka (demo: pokazać to jako feature "user controls")
- Allowance tylko live mode, max 100 USD/okres
- Dokumentacja niespójna (sandbox: Arc testnet vs Kite testnet) — sprawdzić `kpass status`
- Zakupy tylko Amazon, osobna sesja, ≤10 pozycji
- Docs machine-readable: https://docs.gokite.ai/llms.txt · MCP read-only: https://docs.gokite.ai/mcp
