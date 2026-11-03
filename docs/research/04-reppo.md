# Reppo (@reppo) — research (2026-11-03)

**Track 03: "Build reliable agents that turn real-time feedback into measurable improvements."** Docs: https://docs.reppo.ai/concepts/evaluation-api. OpenServ etykietuje to "AI data markets", ale faktyczny brief tracku dotyczy **Evaluation API** (pętle feedbacku), nie starego marketplace'u danych.

## Co to jest (dziś)

- Reppo Labs (spin-out Protocol Labs), $2.2M seed + $20M commitment (IV 2026). Site https://reppo.xyz · app https://reppo.ai · docs https://docs.reppo.ai (index: /llms.txt) · stats https://reppostats.com · GitHub https://github.com/Reppo-Labs
- **Datanets** (Base mainnet): rynki domenowe, gdzie Publisherzy publikują "pody" (tweet/obraz/wideo/tekst/anotacja/output agenta jako NFT), Voterzy lockują REPPO → veREPPO i głosują w 48-h epokach. 19 datanetów live (geopolityka/misinfo, prediction markets, RWA, robotyka, kod…).
- **Evaluation API** — to, co nas interesuje: niezależni sędziowie (nody "Orquestra" + zewnętrzne agenty) oceniają `answer | plan | trace | artifact`.
- Tokeny: $REPPO (Base `0xFf8104251E7761163faC3211eF5583FB3F8583d6`), $EVAL (Base, staking za kredyty — jeszcze nie live).

## Evaluation API

- Base: `https://eval.reppo.xyz/api/v1` · Auth: `Authorization: Bearer <API_KEY>` — **klucz tworzy człowiek w konsoli** https://eval.reppo.xyz (sidebar "API Key", pokazany raz)
- Kredyty: bonus na start (docs: 1 000 kredytów = 10 ewaluacji; agents.md: 22 000 — sprawdzić w konsoli); 100 kredytów = 1¢ per eval; doładowanie kartą $1–$50; płacisz tylko za SETTLED
- Limity: **1 pending evaluation per konto**; payload ≤50 KB; context ≤32 KB; criteria 0–10 × ≤2 KB (pusta tablica → Reppo wybiera 2–5 wymiarów); 1 załącznik ≤2 MB (png/jpeg/webp/pdf); `settlementMinutes` ∈ {10,15,30,60,120,360,720,1440}, default 15; wynik zwykle ≤5 min po zamknięciu okna; max 3 peer assessments

### Endpointy

```
POST /agents/eval-requests/submit            → 201 { evalId, status: "PENDING" }
GET  /agents/eval-requests/{evalId}          → status PENDING|SETTLED|FAILED, result{...}
POST /agents/eval-requests/attachments       → { key, uploadUrl } (PUT 5 min)
GET  /agents/eval-requests/pending?page=1    → (rola sędziego) cudze pending evals
POST /agents/eval-requests/{evalId}/assessments { agentName, modelName, score 0-100, decision, critique } → 201
```

Body submit:
```json
{
  "type": "trace",
  "payload": "<output agenta ≤50KB>",
  "criteria": ["Followed the user's constraints", "Every cited number exists in source"],
  "context": "<cel, odbiorca, ograniczenia ≤32KB>",
  "settlementMinutes": 10
}
```

Wynik: `result.verdict { score 0–100, decision accept|revise|reject, confidence high|medium|low }`, `result.verdicts[] { criterion, score 0–10, critique }`, `result.action.route auto-ship|review|block`, `result.evidence { evidenceBasis: community-pods|model-judgment, pods[], peerAssessmentCount }`, `peerAssessments[]`.

### x402 "lite lane" (bez konta, natychmiast, bez peer judges)

- `POST /x402/evals/lite` — **$0.22 USDC na Base** per call przez x402 (402 → podpis → resend); zwraca `readToken x402rt_…`
- `POST /x402/credits?usd=1..100` → prepaid credit token `x402ck_…` (2 000 kredytów/USDC, 440 per lite eval)
- `GET /x402/evals/{evalId}`
- **Nagłówek `Sandbox: true` → darmowy placeholder verdict** (score 0, decision revise, niezapisywany) — do developmentu
- Lite ignoruje `settlementMinutes` i załączniki

Szczegóły: https://eval.reppo.xyz/agents.md

## Pozostałe API (gdyby pomysł dotykał datanetów)

- Platform API `https://reppo.ai/api/v1`: publiczne `GET /public/subnets`, `/public/pods?filters[subnet]=…`, `/public/pods/search?q=`, `/stats` (bez auth)
- Custom Agents API: `POST /agents/register {name, description}` → `{id, apiKey}`; subskrypcja datasetu: `GET /agents/subnets/{id}/datasets/subscriptions/packages` → płatność on-chain → `POST …/orders {txHash}` → `GET …/datasets`
- Agent/Chat API `https://api.reppo.xyz`: auth portfelem (nonce → sign → verify), `POST /pods/mint {tweetUrl}`
- CLI: `npm i -g @reppo/cli` (query/list/vote/mint-pod/lock/claim-emissions); `claude plugin install reppo`
- Orquestra (self-hosted judge node, Docker): https://github.com/Reppo-Labs/orquestra — opt-in "eval-work lane"

## Kto już buduje z Reppo w Hackathonie 02

- **Tranche** (PhiBao) — trace milestone'u → Reppo `trace` → polityka: SERV reject/Reppo reject → BOUNCE, SERV revise → REVIEW, else RELEASE
- **Crux PR #2** (Mhiah) — opt-in Reppo review outputów researchu
- Wzorzec Reppo: Orquestra jako sędziowie; reppo-polyagent (Polymarket) jako konsument sygnałów datanetu

## Ograniczenia do zaprojektowania

- Standardowa ewaluacja jest **asynchroniczna** (min. 10 min + ≤5 min) i **1 pending na konto** → pętla "real-time" wymaga lite lane (x402, natychmiast) albo wielu kluczy
- Ewaluacje są **publiczne** na feedzie (submitter anonimowy) — nie wysyłać danych poufnych
- Peer judges są samo-deklarowani (`agentName/modelName`), nieopłacani w v1; werdykt końcowy może się różnić od peerów
- `evidenceBasis` bywa `model-judgment`, gdy brak podów w datanetach
- Niespójności docs: liczby kredytów, cena lite ($0.22 vs $0.05 w README Tranche — ufać agents.md), dwa adresy PodManager
