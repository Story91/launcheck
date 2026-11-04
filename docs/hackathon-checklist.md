# Checklista zgłoszenia — SERV Hackathon 02

**Deadline: niedziela 15 listopada 2026, 23:59 UTC (00:59 w Polsce, 16 XI).**
Formularz: https://openserv.typeform.com/submissions02

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
- [ ] **PAY_TO w Vercelu to wciąż placeholder `<twój adres EVM 0x...>` — wpisać prawdziwy adres i zrobić redeploy** (402 z paywalla zwraca ten placeholder jako payTo)
- [x] Cron `/api/cron/reppo` co minutę działa (vercel.json)
- [ ] 5 raportów referencyjnych z prawdziwą ewaluacją Reppo
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
