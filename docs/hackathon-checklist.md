# Checklista zgłoszenia — SERV Hackathon 02

**Deadline: niedziela 15 listopada 2026, 23:59 UTC (00:59 w Polsce, 16 XI).**
Formularz: https://openserv.typeform.com/submissions02

## Kontrola 6 XI 2026

Ta sekcja zastępuje starsze wpisy o brakującym deployu, bazie i kluczu Reppo poniżej; historyczne pomiary pozostają zapisane z datą.

- [x] Publiczna strona produkcyjna odpowiada HTTP 200; `/api/notices` zwraca dane.
- [x] `/healthz` odpowiada HTTP 200: Kite testnet, pieUSD, cena $0.50.
- [x] Publiczne API raportu NBP `722731-2026` odpowiada HTTP 200, Reppo `SETTLED`, `sandbox: false`.
- [x] Lokalne poprawki: identyfikatory SAM.gov w x402, limit oczekiwania na upstream, bezpieczna walidacja JSON, informacja o niedostępnej konfiguracji, zakończenie przerwanego generowania stanem failed i widoczny błąd połączenia w UI.
- [x] Testy x402 nie wymagają internetu; prawdziwy middleware działa z mockowaną odpowiedzią facilitatora.
- [x] Weryfikacja lokalna: 198 testów (core 114, web 72, x402 12), TypeScript we wszystkich trzech pakietach i build produkcyjny Next.js przechodzą.
- [x] Sprzedaż wymaga zakończonego werdyktu Reppo zgodnego ze statusem raportu; zadania cron odmawiają uruchomienia również przy brakującym CRON_SECRET.
- [x] Produkcyjny paywall zwraca HTTP 402, a cron Reppo bez autoryzacji HTTP 401. Cztery raporty USA widoczne na stronie mają rzeczywiste werdykty SETTLED/revise; kolejny ma PENDING.
- [x] Poprawki wdrożone 6 XI: commit `d6e6de1`, Vercel success. Na produkcji potwierdzono HTTP 200 strony, dokumentacji i raportu NBP, HTTP 400 dla nieprawidłowego JSON (`null`, liczbowy noticeId), HTTP 401 cron bez autoryzacji oraz HTTP 402 z warunkami płatności dla identyfikatora SAM.gov. Zakup i rozliczenie nadal wymagają osobnego testu z passkey.
- [ ] Potwierdzić rzeczywisty zakup przez `kpass` na testnecie z konta właściciela (passkey); działające HTTP 402 nie dowodzi rozliczenia płatności.
- [ ] Potwierdzić komplet pięciu raportów referencyjnych z aktualnymi werdyktami; nie uruchamiano dodatkowych płatnych analiz podczas kontroli.
- [ ] Wideo, publikacja na X i wysłanie zgłoszenia. Pliki w `docs/submission/` są materiałami roboczymi, nie dowodem publikacji.
- [ ] Kontrola wizualna w przeglądarce: automatyczne uruchomienie przeglądarki przekroczyło limit czasu; odczyty HTTP nie zastępują tej kontroli.

## Przed startem kodowania
- [x] Pre-rejestracja (daje $5 kredytów SERV): https://openserv.typeform.com/registerhack02 (track Dolphin zaznaczony; finalnie zgłaszamy Open)
- [x] Konto + klucz SERV: https://console.openserv.ai → Settings → Keys → wpisać do `.env`
- [x] Doładować konto SERV (żądania są odrzucane, gdy saldo nie pokrywa szacowanego sufitu)
- [x] Dolphin: wallet + Telegram → kupon `API10` ($10) → klucz (zmierzony: za wolny na primary, zostaje jako bulk)
- [ ] **Reppo: klucz w https://eval.reppo.xyz (tworzy człowiek) → `REPPO_EVAL_API_KEY` w `.env`; bez niego cron zwraca `skipped`**
- [ ] **Kite: `irm https://cli.gokite.ai/install.ps1 | iex` → `kpass signup init` → passkey w https://agentpassport.ai → `kpass sandbox on` → `kpass faucet drop --token pieUSD` → test na `passport.dev.gokite.ai/x402/test`**
- [ ] Dołączyć do Discorda OpenServ (https://discord.com/invite/9u724WsWCU) — tam ogłoszą podział nagród i detale tracków

## Stan builda (4 XI)
- [x] `packages/core` pipeline + 62 testy; live run na NBP 722731-2026: 27 s, $0.009, S2 BRAND_LOCK high
- [x] `apps/web` UI + API + worker Reppo (17 testów), zweryfikowane w przeglądarce
- [x] `apps/x402` paywall (5 testów)
- [x] Repo GitHub `Story91/tendr` (main + feat/tendr), historia jako Story91
- [x] Projekt Vercel `tendr` w teamie Story Project's (prj_fYlagLPSrA3a5sWrOG7NhowedWQA), preset Services, powiązany z GitHubem; 10 zmiennych wgranych (modele, tryby, INTERNAL_SECRET, CRON_SECRET)
- [x] Produkcja https://tendr-ecru.vercel.app: strona główna 200 publicznie; paywall `/healthz` startuje i zgłasza brak `PAY_TO`; web zwraca 500 do czasu `DATABASE_URL`
- [ ] W panelu Vercel sprawdzić Settings → Deployment Protection (Vercel Authentication włączona domyślnie; produkcyjny alias odpowiadał 200, previews mogą wymagać logowania)
- [x] Sekrety wklejone (SERV, Reppo, Dolphin); Neon podłączony przez integrację Vercel (prefix STORAGE → `STORAGE_DATABASE_URL`); tabele utworzone przez `POST /api/admin/migrate` (bearer CRON_SECRET)
- [x] Ingest przez oficjalne API TED (strona XML ted.europa.eu zwraca z Vercela 202/WAF); raport NBP na produkcji: 35 s, 55/100, S2+S4+S7
- [x] PAY_TO ustawione; 402 z paywalla podaje prawdziwy adres, Kite testnet, 0.5 pieUSD
- [x] Cron `/api/cron/reppo` co minutę działa (vercel.json)
- [x] Pierwsza prawdziwa ewaluacja Reppo na produkcji: NBP 722731-2026 → SETTLED, decision revise, score 77, confidence medium (cytaty verbatim OK, severity OK, uwaga: ton opisów lekko negatywny → do poprawy w prompcie)
- [ ] **SERV: saldo $0.00 — doładować konto na console.openserv.ai → Settings → Billing; 4 raporty referencyjne padły na "Insufficient credits" i czekają na ponowienie**
- [ ] 5 raportów referencyjnych z werdyktem Reppo (1/5 gotowy)
- [ ] Zakup przez `kpass` na testnecie (fallback: Base mainnet USDC do 10 XI)

## Wymagania twarde (cytaty ze strony)
- [ ] **"SERV Reasoning must be part of your build."** — i ma to być widoczne (system prompt → graf, marker tools, sufiksy -serv-kronos/-serv-multipath)
- [ ] Publiczne repo (GitHub)
- [ ] Demo link **lub** wideo (nie trzeba deployu, ale deploy = "user readiness")
- [ ] Write-up: co robi · jak używa SERV Reasoning · który track
- [ ] **Post na X przed deadlinem**, link do posta w formularzu
- [ ] Oznaczyć @openservai + partnera tracku (@dphnAI / @GoKiteAI / @reppo)

## Kryteria oceny (cytat): "creativity, user readiness and revenue potential"
- [ ] **Creativity** — problem, którego nikt w Ed. 01 nie dotknął (patrz `docs/research/05-prior-art.md`)
- [ ] **User readiness** — działający UI, onboarding w <2 min, prawdziwe dane, nie mock
- [ ] **Revenue potential** — jasny model: kto płaci, ile, za co (x402 per-call to naturalny dowód)

## Co pokazać jurorom w demo (maks. 3 min)
1. Problem w jednym zdaniu
2. Wejście = prawdziwe dane
3. Krok SERV: pokazać system prompt i wynik w konsoli OpenServ (usage/activity) jako "auditable steps"
4. Decyzja agenta + dowód (trace / verdict / receipt)
5. Płatność / efekt w świecie
6. Ile to kosztowało (porównanie model raw vs SERV z Playgrounda)

## Harmonogram (14 dni)
| Dni | Co |
|---|---|
| 3–4 XI | wybór pomysłu, spec, plan, klucze, smoke-testy API |
| 5–8 XI | rdzeń: pętla SERV + integracja partnera + minimalny UI |
| 9–11 XI | prawdziwe dane, edge-case'y, audit trail, koszty |
| 12–13 XI | deploy (Vercel), polish UI, README, write-up |
| 14 XI | wideo demo, post na X, zgłoszenie (bufor 1 dzień) |
| 15 XI | bufor / poprawki |
