# Dolphin (dphn.ai / @dphnAI) — research (2026-11-03)

**Track 01: "Build agents on decentralized open-source models."** Jedyny link partnera: https://dphn.ai/docs/coupon-credits/ (czyli: spodziewaj się kuponu). Brak opublikowanej rubryki ani nagrody per track.

## Co to jest

- Projekt Erica Hartforda (rodzina modeli "Dolphin", Cognitive Computations). Dolphin Foundation (Kajmany).
- DePIN **zdecentralizowana sieć inferencji GPU na Base** ("peer-to-pool"): jeden endpoint OpenAI-compatible, żądania routowane do puli nodów z tym samym modelem.
- Token **POD** (dawniej DPHN), Base `0xeD664536023d8E4b1640C394777D34aBAFF1dF8F`. 100% przychodu z inferencji w nie-POD → buyback POD.
- Lab modeli: HF org https://huggingface.co/dphn (Dolphin X1, Dolphin 3.0, Dolphin Mistral 24B Venice Edition…). **Te modele NIE są dziś na publicznym API.**
- Open-source silnik inferencji **Sonar** (fork vLLM, dawniej Aphrodite): https://github.com/dphnAI/sonar · https://sonar.dphn.ai
- Datagen (synthetic data): https://datagen.dphn.ai · Chat: https://chat.dphn.ai · Telegram bot @DolphinAI_bot

## Developer API (zweryfikowane curl-em: endpoint żyje)

- Base URL: `https://lighthouse.dphn.ai/run/text-v/v1`
- Auth: `Authorization: Bearer $DOLPHIN_API_KEY`
- Endpointy: **tylko** `POST /chat/completions` i `GET /models`
- Modele (sprawdzone naszym kluczem 2026-11-03 wieczorem, `GET /models`):
  - **`deepseek-ai/DeepSeek-V4.1-Flash`** — kontekst **1 048 576**, **$0.01/M in, $0.07/M out**
  - `nvidia/Gemma-4-26B-A4B-NVFP4` — kontekst 262 144 (cena nieopublikowana)
  - `nvidia/Qwen3.6-35B-A3B-NVFP4` — kontekst 32 768 (cena nieopublikowana)
  Katalog jest dynamiczny; przed demo sprawdzić ponownie.
- Nowe konto ma **0 kredytów** → każde wywołanie zwraca HTTP 402 `insufficient credits`, dopóki nie zrealizujesz kuponu (Redeem Code w app.dphn.ai).
- Błędy: 401 zły klucz, **402 brak kredytów**, 404 nieznany model, 429 (honoruj `Retry-After`)
- Fallback: przy awarii sprzętu żądania idą do providerów ZDR na OpenRouter (decentralizacja częściowa)
- Brak SDK (użyj OpenAI SDK), brak MCP, brak embeddings/images/audio, tool-calling i JSON mode nieudokumentowane (DeepSeek upstream je wspiera — przetestować)

```ts
import OpenAI from "openai";
const dolphin = new OpenAI({
  apiKey: process.env.DOLPHIN_API_KEY,
  baseURL: "https://lighthouse.dphn.ai/run/text-v/v1",
});
const r = await dolphin.chat.completions.create({
  model: "deepseek-ai/DeepSeek-V4.1-Flash",
  messages: [{ role: "user", content: "Hello, Dolphin!" }],
});
```

## Jak zdobyć klucz i kredyty

1. app.dphn.ai (→ v2.dphn.ai) → connect wallet → podpisz darmową wiadomość
2. "Open Telegram" → Start w bocie
3. Redeem Code: publiczny kupon **`API10` = $10** (https://dphn.ai/API/); kupon hackathonowy → zapytać na Telegramie Dolphina / Discordzie OpenServ
4. API Keys → Create Key
Kredyty w USD; płatność POD/ETH/BTC/USDC/XMR/ZEC, karta "w przygotowaniu".

## Kluczowy fakt integracyjny

Katalog SERV Reasoning to **wyłącznie OpenAI/Anthropic/Google (+ jev)** — nie ma DeepSeeka ani modeli Dolphina i nie ma "bring your own base URL". Zatem "SERV + Dolphin" robi się w naszym kodzie:

- **SERV** → planowanie, decyzje, walidacja, graf rozumowania (małe modele + audyt)
- **Dolphin** → tanie masowe wykonanie: czytanie gigantycznych dokumentów (1M ctx), ekstrakcja, streszczanie, tani "drugi sędzia"

Przykład wzorca: SERV (gpt-5.4-nano + shadow agent) decyduje *co* wyciągnąć i *jak* zweryfikować; Dolphin czyta 800-stronicowy PDF za ~$0.01.

## Ograniczenia

- Jeden model, dwa endpointy, brak limitów opublikowanych, brak status page/changelogu
- Onboarding wymaga portfela + Telegrama
- Brak gotowych przykładów hackathonowych na Dolphinie — pole do bycia pierwszym
