# Checklista zgłoszenia — SERV Hackathon 02

**Deadline: niedziela 15 listopada 2026, 23:59 UTC (00:59 w Polsce, 16 XI).**
Formularz: https://openserv.typeform.com/submissions02

## Przed startem kodowania
- [ ] Pre-rejestracja (daje $5 kredytów SERV): https://openserv.typeform.com/registerhack02
- [ ] Konto + klucz SERV: https://console.openserv.ai → Settings → Keys → wpisać do `.env`
- [ ] Doładować konto SERV (żądania są odrzucane, gdy saldo nie pokrywa szacowanego sufitu)
- [ ] Jeśli track Dolphin: wallet + Telegram → kupon `API10` ($10) → klucz; zapytać na Discordzie OpenServ o kupon hackathonowy
- [ ] Jeśli track Reppo: klucz w https://eval.reppo.xyz (tworzy człowiek), sprawdzić saldo kredytów; w devie używać `Sandbox: true`
- [ ] Jeśli track Kite: `irm https://cli.gokite.ai/install.ps1 | iex` → `kpass signup init` → passkey w https://agentpassport.ai → `kpass sandbox on` → `kpass faucet drop --token pieUSD`
- [ ] Dołączyć do Discorda OpenServ (https://discord.com/invite/9u724WsWCU) — tam ogłoszą podział nagród i detale tracków

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
