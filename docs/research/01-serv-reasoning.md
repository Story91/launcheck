# SERV Reasoning API — research (stan na 2026-11-03)

> Obowiązkowy element każdego zgłoszenia. Wszystko poniżej zweryfikowane z docs.openserv.ai.

## Hackathon 02 — logistyka

| Co | Wartość |
|---|---|
| Strona | https://www.openserv.ai/hackathon-2 |
| Termin | 2–15 listopada 2026, online. **Deadline: 15 XI 2026, 23:59 UTC** |
| Formularz zgłoszenia | https://openserv.typeform.com/submissions02 |
| Pula nagród | **$5 000 łącznie** na wszystkie tracki (podział "ogłoszony na kickoffie", dalej TBA). Kategorie: 2× track winner, best overall build, special mention. Edycja 01 płaciła $1 000 w SERV per track + $1 000 USDC best overall |
| Kryteria oceny (cytat) | **"Judged on creativity, user readiness and revenue potential."** |
| Wymagania zgłoszenia | publiczne repo; demo link lub wideo; krótki write-up (co robi, jak używa SERV Reasoning, który track); **post na X z linkiem w formularzu**; "SERV Reasoning must be part of your build" |
| Istniejące projekty | dozwolone, jeśli dodamy "meaningful feature" |
| Konto | https://console.openserv.ai (klucz API). Pre-rejestracja daje $5 kredytów: https://openserv.typeform.com/registerhack02 |
| Społeczność | Discord https://discord.com/invite/9u724WsWCU · Telegram https://t.me/openservai · X @openservai |

### Tracki (każdy wymaga SERV Reasoning)

1. **Dolphin (@dphnAI)** — "Build agents on decentralized open-source models." → `docs/research/02-dolphin.md`
2. **Kite (@GoKiteAI)** — "Build agents with a verifiable identity and spending limits you control, so they can shop, book, and pay on your behalf." → `docs/research/03-kite.md`
3. **Reppo (@reppo)** — "Build reliable agents that turn real-time feedback into measurable improvements." → `docs/research/04-reppo.md`
4. **Open Track** — "Bring your own idea… Any domain, any stack."

Hasło OpenServ: *"Real data, real decisions, auditable steps."* oraz *"get more from smaller models, cut costs, and make every agent decision auditable"*.

"26/27 milestones" z posta na X to licznik roadmapy marketingowej (26 z 27 punktów zrobionych), nie koncept techniczny i nie wymóg hackathonu.

## Czym jest SERV Reasoning (mechanizm)

Oparty na BRAID (arXiv:2512.15959). Model-generator kompiluje **system prompt** w ograniczony graf rozumowania (kroki, gałęzie, kontrakty I/O, pętla weryfikacji); żądany model-solver (może być mały i tani) wykonuje z tym grafem jako kontekstem. Wygenerowany graf jest **cache'owany per organizacja na 30 dni**, kluczowany po system promptcie (nie po modelu).

**Konsekwencja projektowa:** system prompt ma być stabilny, dane zmienne idą w user message. Opt-out: `metadata: { prompt_cache: "disabled" }` lub nagłówek `X-OpenServ-Prompt-Cache: false`.

Wersje: **v2** = obecne publiczne API. **v3 "Graph Sharding"** (Script nodes / Decision nodes na modelu `jev-latest` / Agent nodes) jest w zamkniętej becie — brak publicznego endpointu, zapisy: http://openserv.typeform.com/graphsharding. v4 to roadmapa 2027.

## API

- Base URL: `https://inference-api.openserv.ai`
- Auth: `Authorization: Bearer $SERV_API_KEY`
- Endpointy:
  - `POST /v1/chat/completions` — format OpenAI, wszystkie modele z katalogu (także Claude, Gemini)
  - `POST /v1/responses` — format OpenAI Responses, tylko modele OpenAI; zwraca reasoning summaries
  - `POST /v1/messages` — format Anthropic; OpenAI/Anthropic/xAI/Qwen/DeepSeek/Gemma (nie Gemini)
- **System prompt jest WYMAGANY** (inaczej 400 "A system prompt is required…").
- SDK OpenAI: baseURL z `/v1`. SDK Anthropic: baseURL bez `/v1`, pole `authToken`.
- API **nie zwraca żadnych dodatkowych pól** (brak trace ID, grafu, kosztu w odpowiedzi). Audyt widać w konsoli: https://console.openserv.ai/usage (views: cost / performance / tokens / activity / safety / shadow-agent).
- Streaming: SSE na wszystkich trzech endpointach.
- Structured output: `response_format: { type: "json_schema", json_schema: { name, strict: true, schema } }`.
- Błędy: 400 brak system promptu/zły model, 401, 404, 429 (limity nieopublikowane), 5xx upstream. Żądanie może być odrzucone, jeśli saldo nie pokrywa szacowanego sufitu kosztu.

### Minimalny kod

```ts
import OpenAI from "openai";
const serv = new OpenAI({
  baseURL: "https://inference-api.openserv.ai/v1",
  apiKey: process.env.SERV_API_KEY,
});
const r = await serv.chat.completions.create({
  model: "gpt-5.4-mini",
  messages: [
    { role: "system", content: "You are a concise assistant." },
    { role: "user", content: "Hello!" },
  ],
});
```

Vercel AI SDK: `createOpenAI({ baseURL: "https://inference-api.openserv.ai/v1", apiKey })`.
Python: `OpenAI(base_url="https://inference-api.openserv.ai/v1", api_key=...)`.
Anthropic SDK: `Anthropic(base_url="https://inference-api.openserv.ai", auth_token=...)`.

### Sterowanie specyficzne dla SERV (to, co warto pokazać jurorom)

**Marker tools** — deklarujesz tool o nazwie `serv_*`; SERV stosuje funkcję i usuwa tool zanim trafi do modelu:

| Tool | Co robi | Uwagi |
|---|---|---|
| `serv_prompt_guard` | guard wejścia: injection/leak; odmawia bez wywołania upstream | 502 jeśli nie da się zbudować grafu |
| `serv_shadow_agent` | pętla validate-and-iterate; param `hint` (string), `max_iterations` 1–10 (default 3) | **nie działa ze stream** (400); gdy wyczerpie próby zwraca ostatnią z outcome `exhausted` |
| `serv_disable_content_filter` | wyłącza filtr wycieku system promptu | Chat/Responses only |

```ts
tools: [
  { type: "function", function: { name: "serv_prompt_guard" } },
  { type: "function", function: {
      name: "serv_shadow_agent",
      parameters: { type: "object", properties: {
        hint: { type: "string", default: "Verify every cited number exists in the input." },
        max_iterations: { type: "integer", default: 3 } } } } },
  // własne function tools można mieszać w tej samej tablicy
]
```

**Sufiksy modelu:**
- `<model>-serv-kronos` — Kronos audytuje i naprawia wygenerowany graf (dodatkowe wywołanie przy cache miss)
- `<model>-serv-multipath` — transformacja Multipath dla instrukcji rozgałęzionych / drzew decyzyjnych / macierzy polityk
- `<model>-serv-kronos-multipath` — oba

Playground z porównaniem Raw vs SERV (koszt/tokeny/latencja): https://console.openserv.ai/playground

### Modele i ceny ($/M tokenów in/out, ceny zawierają SERV Reasoning)

Tanie, od których zaczynać: **gpt-6-luna 0.13/0.65 (1M ctx)**, **gpt-5.4-nano 0.25/1.60 (128K)**, gpt-5.6-luna 0.25/1.50, gemini-3.1-flash-lite 0.30/1.80, gemini-2.5-flash 0.40/3.50, **gpt-5.4-mini 1.00/6.00 (400K)**, claude-haiku-4.5 1.25/6.50 (200K).
Droższe: gpt-5.4 3.25/20, claude-sonnet-5.5 2.4/12, claude-opus-5.5 4.8/24, gpt-6-astra 12/60, claude-fable-5-1 12/60. Pełna lista: https://docs.openserv.ai/serv-reasoning/models.md

Zalecenie OpenServ ("day one"): zacząć od najtańszego modelu i `reasoning_effort: "low"`.

Komponenty rozliczane per request: inference upstream + generacja grafu (pomijana przy cache hit) + prompt guard + Kronos + walidacje shadow agenta.

### Liczby do pitchu (vendorowe, nie niezależne)

- GSM-Hard: GPT-4.1 generator + GPT-5-nano solver = 96% przy 74× performance-per-dollar
- MultiChallenge: GPT-4o 19.9% → 53.7% z BRAID
- Case study Neol: ekstrakcja CV 54.1% → 100% na 2 400 runach (gpt-5.4-nano)
- Strona produktu: "up to 100× cheaper per call", 0 vs 14 failures na 120 przypadkach

## OpenServ Agent SDK (opcjonalne; hackathon wymaga tylko Reasoning API)

- `@openserv-labs/sdk` 2.4.1 (TypeScript, MIT) — https://github.com/openserv-labs/sdk
- `@openserv-labs/client` 2.5.3 — klient platformy (workflows, triggers, `triggers.x402()`, ERC-8004 identity on Base)
- Skille dla Claude Code: `npx skills add openserv-labs/skills` (openserv-agent-sdk, openserv-client, openserv-launch, openserv-multi-agent-workflows)
- Platforma/agent builder: https://platform.openserv.ai · x402 marketplace: https://platform.openserv.ai/x402-services

## Linki docs

- Index: https://docs.openserv.ai/llms.txt
- API overview: https://docs.openserv.ai/serv-reasoning/api.md
- Tools: https://docs.openserv.ai/serv-reasoning/tools.md
- Shadow agent: https://docs.openserv.ai/serv-reasoning/tutorials/shadow-agent.md
- Kronos: https://docs.openserv.ai/serv-reasoning/tutorials/kronos.md
- Multipath: https://docs.openserv.ai/serv-reasoning/tutorials/multipath.md
- Prompt caching: https://docs.openserv.ai/serv-reasoning/tutorials/prompt-caching.md
- Billing: https://docs.openserv.ai/serv-reasoning/tutorials/usage-and-billing.md
- SDK migration: https://docs.openserv.ai/serv-reasoning/sdk-migration.md
