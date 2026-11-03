# Prior art — czego NIE powtarzać (2026-11-03)

## SERV Hackathon Edition 01 (14–28 IX 2026, 70+ zgłoszeń)

Źródło: https://www.openserv.ai/hackathon · https://x.com/openservai/status/2107116454080581890

| Projekt | Co robił | Wynik |
|---|---|---|
| **ASSAY** | audyt wycen tokenów giełdowych na Robinhood Chain vs on-chain (błędy splitów) | Best Overall |
| **Shijima** | autonomiczny portfel US-stock-tokens w limitach usera | track winner |
| **Payrun** | agent payroll: sprawdza faktury kontraktorów vs polityka → pay/hold/block | track winner |
| **CapitalRail** | pre-check depozytu do RWA vault | track winner |
| **SERVPIT** | 6 agentów z portfelami w arenie | honorable mention |
| Ledgerly | agent treasury | featured |
| T1000 | yield management | featured |
| StewardPay | tokenizowane akcje przez WhatsApp | featured |
| Tern | trading agent na niezaufanym tekście | featured |
| **Tender** | płaci x402 tylko za dane, których potrzebuje (AgentKit, Base) | featured |
| **Agent Preflight** | wyłapuje zepsute workflowy AI przed wykonaniem | featured |
| **Urai** | A/B "SERV on vs off" na Twoim agencie | featured |
| Crux | analityk market-research | featured |
| Judr | arbitraż escrow RWA | featured |
| Choiceproof | test spójności decyzji przy perturbacji inputu | featured |
| Talos | stop-loss agent | featured |
| EXHIBIT A | obrona chargebacków | featured |
| Stet | decyzje refundowe z polityki sklepu | featured |
| Pich | triage doradczy | featured |
| seeri, PuffPay, Arena 67, Prompt Guard benchmark, DealClerk, Hatrey, Pond Agent | token safety, split płatności, memecoiny, benchmark, fiduciary layer, arbitraż cross-chain | — |

Starsze (platformowe): Escroue ("Fiverr for agents"), Murmur, Shōbu, StakeHumanSignal, AOX.

## Już budują w Edycji 02 (publiczne repo)

- **Tranche** (Kite+Reppo): proof-gated milestone payments, Rust/Axum + Next.js, https://github.com/PhiBao/tranche, live https://tranche-serv.fly.dev
- **Signoff**: testnet "acceptance-deposit" processor dla pracy agentów

## Wzorce już "spalone" (jurorzy widzieli to wielokrotnie)

1. Gate "polityka → pay / hold / block" na fakturach, refundach, chargebackach, payrollu, milestone'ach
2. Escrow / arbitraż między stronami
3. Trading / portfel / stop-loss / yield / memecoiny
4. "Tester SERV": A/B on-off, prompt-guard benchmark, spójność decyzji, preflight workflowów
5. Treasury / split płatności w grupie
6. Agent-marketplace "Fiverr for agents"

## Czego brakuje (biała przestrzeń)

- Nic na **Dolphinie** (zero zgłoszeń, zero przykładów) — bycie pierwszym w tracku jest realne
- Nic, co używa **1M kontekstu** jako przewagi (masowe czytanie dokumentów)
- Nic z **danymi publicznymi / sektorem publicznym** (przetargi, dotacje, rejestry)
- Nic, gdzie agent jest **płatnikiem wobec ludzi** (odwrócony Mechanical Turk)
- Nic na temat **ubezpieczeń / ryzyka agentów** (Kite ma reputację + audit trail = gotowe dane underwritingowe)
- Nic z **"dead-man switch" / ciągłością** (agent działa, gdy właściciel nie może)
- Nic z **security triage** (bug bounty, vuln reports) — mimo że to wprost "policy + payout + second opinion"
