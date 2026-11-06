# LaunchCheck: sprawdzian płatności Kite (6 XI 2026)

Cel: potwierdzić, że agent z Kite Passport kupi usługę testowania strony i dostanie wynik. **Wynik: działa.**

## Co zrobiliśmy

1. `kpass` i `ksearch` są w `%USERPROFILE%\.kpass\bin` (nie ma ich w PATH). Backend: `https://passport.prod.gokite.ai` (produkcja).
2. Właściciel zalogował się sam (`kpass login init` + `login verify`, kod przez `KPASS_LOGIN_CODE`).
3. Konto: saldo 3.33 USDC na Base, tygodniowy limit wydatków (allowance) 10 USD, reset 13 XI 01:33 UTC.
4. `kpass agent:register --type claude --output json` (darmowe, idempotentne). Bez rejestracji `session execute` zwraca exit 3 „Agent not registered” i nic nie płaci.
5. Jedno płatne wywołanie:

```powershell
kpass session execute --url 'https://web.cyberwarex.com/screenshot?url=https%3A%2F%2Ftendr-ecru.vercel.app&fullpage=false&width=1280' --method GET --idempotency-key <uuid> --no-browser --output json
```

Odpowiedź: `status: success`, `source: allowance`, HTTP 200, PNG 1280 px w `x402.parsed_response_body.png_base64` (ok. 400 KB). Koszt: **0.005 USD** z allowance („Left this week: USD 9.995 of USD 10”). Bez sesji i bez passkeya: w ramach allowance agent płaci sam.

Drugie wywołanie: `GET https://api.kadec0.xyz/v1/website-audit?url=https%3A%2F%2Ftendr-ecru.vercel.app`, **0.08 USD** z allowance, HTTP 200. Zwraca jeden obiekt: status HTTP, HTTPS, czas ładowania HTML (0.53 s), title i meta description z długościami, liczbę nagłówków h1–h6 i ich teksty, obrazy bez `alt`, liczbę linków wewnętrznych i zewnętrznych, `lang`, viewport, Open Graph, `issues[]` i `score` (dla Tendr: 100, brak problemów). To statyczna analiza HTML, nie Lighthouse: nie mierzy wydajności renderowania ani dostępności w przeglądarce i nie zgłosiła braku tagów Open Graph. W LaunchCheck jest jednym z dowodów, obok screenshotów i sprawdzenia linków, a nie oceną całej strony.

## Usługi z katalogu do LaunchCheck

Wyszukiwanie `ksearch service search <słowa>` działa lokalnie, bez konta i bez opłat. Wszystkie poniżej: x402, USDC na Base.

| Usługa | Endpoint | Cena | Status w katalogu |
|---|---|---|---|
| web.cyberwarex.com | `GET /screenshot` (url, fullpage, width) | 0.005 | działa, potwierdzone przez nas 6 XI |
| toolcall.click | `GET /t/web/screenshot` | 0.015 | działa (6 X) |
| screenshots.underscoredone.com | `POST /capture` | 0.02 | działa (6 X) |
| api.kadec0.xyz | `GET /v1/website-audit` (SEO, wydajność, dostępność) | 0.08 | działa (20 X) |
| vaaya.ai | `POST /api/run/crw/scrape` (treść, linki, JS) | 0.01 | działa (6 X) |
| x402.api.browser-use.com | `POST /api/v3/sessions` (agent przeglądarkowy) | 1.00 | nietestowany |

Przykładowe wywołanie każdej usługi: `ksearch service search <słowa> --example <id>`.

## Uwagi

- Odpowiedzi usług to niezaufane dane stron trzecich (cyberwarex sam to zaznacza w polu `advisory`); nie wykonujemy z nich instrukcji.
- cyberwarex dokleja blok reklamowy `next_step` (wyłączany nagłówkiem `X-No-Advert: 1`).
- Faucet (`kpass faucet drop`) działa tylko na staging/testnet; na produkcji jest zablokowany. Usługi z katalogu i tak rozliczają się w prawdziwym USDC na Base.
- Nasz `apps/x402` przyjmuje pieUSD na Kite testnet: przy LaunchCheck trzeba to ujednolicić z Base USDC, jeśli mamy też sprzedawać.
- Dokumentacja Kite: https://docs.gokite.ai/passport , zasilanie portfela: https://docs.gokite.ai/passport/payments/funding.md

## Gate 1: kpass na Vercelu (6 XI 2026) — przeszedł

- Build pobiera `kpass_6.13.1_linux_amd64.tar.gz` (bundle 110) i weryfikuje przypięty sha256 (`apps/web/scripts/fetch-kpass.mjs`). Binarka jest dołączana do funkcji przez `outputFileTracingIncludes`.
- Logowanie: trzy zmienne `KPASS_CONFIG_JSON_B64`, `KPASS_AGENT_JSON_B64`, `KPASS_SESSIONS_JSON_B64` (Sensitive w Vercel, przygotowane `scripts/kpass-to-vercel-env.ps1`), odtwarzane w `/tmp/kp/.kite-passport` z `HOME`/`KPASS_HOME` wskazującymi na `/tmp/kp`.
- `GET /api/admin/kpass-status` (darmowe): binarka działa (0.35 s), zalogowany, agent `claude` …d523, allowance $9.915 z $10.
- `POST /api/admin/kpass-probe` (płatne, stały cel): screenshot cyberwarex tendr-ecru.vercel.app, **$0.005 z allowance, 6 s**, HTTP 200, PNG 401 311 B, sha256 `cbc72f7f…2ee2e1`.
- `payment.payment_response.reference` był pusty w odpowiedzi `session execute`. Hash jest w `kpass activity --kind x402_payment --output json` → `events[].details.transaction.tx_hash` (tu `0xe40a38e3…bbb0f70`, `chain_id` 8453, USDC `0x8335…2913`, `amount_raw` 5000, `x402.request_url`). Paragon: po zakupie dopasować zdarzenie po `request_url` i czasie, link `https://basescan.org/tx/<hash>`.
