# TenderHound — design doc

Data: 2026-11-03. Status: po builder-checku, decyzje właściciela wpisane (§6), czeka na finalne "ok". Hackathon: SERV Hackathon 02, deadline 15 XI 2026 23:59 UTC.

## 1. Intencja i dlaczego

**Jedno zdanie:** TenderHound czyta ogłoszenia o zamówieniach publicznych z TED (Tenders Electronic Daily, UE) i wystawia audytowalny raport sygnałów ograniczenia konkurencji, z dosłownymi cytatami, niezależnym werdyktem jakości (Reppo) i sprzedażą per-call dla agentów (x402).

**Dlaczego:** firmy startujące w przetargach tracą dni na czytanie dokumentacji, zanim zorientują się, że postępowanie jest "pisane pod" jednego dostawcę (nazwana marka bez klauzuli równoważności, integracja z istniejącym systemem, warunek doświadczenia pasujący do jednego gracza, krótki termin). Dziennikarze i NGO robią to ręcznie. Nikt nie ma taniego, obronnego "drugiego oka". Spike z 3 XI na prawdziwym ogłoszeniu NBP (722731-2026) wykrył integrację z DarkTrace bez klauzuli równoważności za ~1 cent w ~50 s.

**Dla hackathonu:** pokazuje "real data, real decisions, auditable steps" (hasło OpenServ) na danych publicznych od ręki; wszystkie trzy partnerskie technologie wchodzą naturalnie, nie na siłę.

## 2. Cele, nie-cele, anty-cele

**Cele (w kolejności priorytetu):**
1. Działający raport dla dowolnego ogłoszenia z TED (po numerze publikacji) w ≤90 s, z cytatami, które naprawdę są w źródle.
2. Każdy raport ma pełny ślad audytu: wersja promptu, model, id żądania SERV, koszt, hash wejścia, wynik weryfikacji cytatów.
3. Każdy raport przechodzi niezależną ocenę Reppo przed publikacją; wynik widoczny jako "verified / disputed / withheld".
4. Raport kupowalny przez agenta jednym wywołaniem HTTP z płatnością x402 (Kite Passport jako kupujący w demo).
5. Deploy publiczny (Vercel) + 3-minutowe wideo + write-up + post na X do 14 XI.

**Nie-cele (świadomie poza zakresem hackathonu):**
- Alerty, subskrypcje, konta użytkowników, panel klienta.
- Polska baza BZP/ezamowienia (TED obejmuje polskie przetargi powyżej progów UE; to wystarczy).
- Pobieranie pełnej SWZ z platform zamawiających (stretch, tylko jeśli zostanie czas; ogłoszenie z TED jest wystarczające, co pokazał spike).
- Płatności fiat, faktury.
- Porada prawna, odwołania do KIO.

**Anty-cele (porażka, nawet jeśli "działa"):**
- Raport, w którym choć jeden cytat nie jest dosłowny. Flaga bez dosłownego dowodu jest usuwana, nie publikowana.
- Język oskarżycielski. Produkt opisuje "sygnały ryzyka ograniczenia konkurencji", nigdy "ustawiony przetarg" ani "oszustwo".
- Blockchain jako dekoracja. Jeśli x402 nie działa end-to-end z prawdziwym zakupem przez Passport, lepiej go nie pokazywać.
- Ukrywanie kosztów i czasu; UI pokazuje realny koszt każdego raportu.

## 3. Ograniczenia

- 12 dni roboczych, jedna osoba + Claude Code.
- Budżet API: SERV (luna domyślnie), Dolphin ($10 kuponu), Reppo (darmowe kredyty + ewentualnie kilka $), Kite testnet (faucet).
- Reppo: standardowa ewaluacja ≥10 min, 1 pending na konto; dev na `Sandbox: true`; ewaluacje publiczne (raporty i tak są publiczne).
- Kite: brak HTTP API, kupujący = CLI `kpass`; sprzedawca = template `kite-x402-services` (Express) z facilitatorem Pieverse na Kite testnet (2368, pieUSD).
- gpt-6-luna jest niestabilna przy długich macierzach: macierz sygnałów dzielona na 2–3 krótsze wywołania, każde z shadow agentem; fallback na gpt-5.4-mini przy pustym/atrapowym wyniku.

## 4. Jak to działa (decyzje podjęte)

### 4.1 Przepływ raportu
1. **Ingest**: użytkownik podaje numer publikacji TED (np. `722731-2026`) lub wybiera z listy ostatnich polskich ogłoszeń IT (TED API v3 search, publiczne, bez klucza). Pobieramy XML eForms i spłaszczamy do tekstu (jak w spike'u).
2. **Ekstrakcja faktów** (Dolphin, DeepSeek V4.1 Flash, `response_format: json_object`; fallback SERV `gemini-3.1-flash-lite` ze strict schema). Wynik: `TenderFacts` (buyer, title, cpv, value, deadline, daysToDeadline, procedure, lots, awardCriteria, participationConditions[], technicalRequirements[], brandOrProductNames[], equivalenceClausePresent, incumbentSystemMentioned, notes[]).
3. **Macierz sygnałów** (SERV, luna, `-serv-multipath`, `serv_shadow_agent` z hintem verbatim, `serv_disable_content_filter`, strict json_schema). Osiem sygnałów w trzech wywołaniach:
   - A: S1 SHORT_DEADLINE, S5 PRICE_WEIGHT_LOW, S7 NO_LOTS (fakty liczbowe)
   - B: S2 BRAND_LOCK, S3 OVER_SPECIFICATION, S4 EXPERIENCE_LOCK (wymagania)
   - C: S6 DISPROPORTIONATE_CONDITIONS, S8 UNUSUAL_NOTES (warunki)
   Każdy sygnał: `fired`, `severity` (none/low/medium/high), `reason`, `evidence[]`.
4. **Weryfikacja cytatów** (kod, nie LLM): każdy `evidence` musi być podciągiem tekstu źródłowego (po normalizacji białych znaków i cudzysłowów). Cytat niedosłowny → usunięty; sygnał bez dowodu → `fired=false`. Liczba usuniętych zapisana w audycie.
5. **Scoring** (kod): high 25, medium 12, low 5, cap 100. Streszczenie (SERV, luna, 2 zdania, neutralny ton, język = język UI).
6. **Reppo**: raport (markdown) jako `type: "artifact"` z kryteriami: "każdy sygnał ma dosłowny cytat ze źródła", "ton neutralny, brak oskarżeń", "severity zgodne z regułami". `accept` → `verified`; `revise` → `disputed` (publikujemy z werdyktem i krytyką); `reject` → `withheld` (raport niewidoczny publicznie, widoczny właścicielowi z powodem). Dev: `Sandbox: true`. Demo: prawdziwa ewaluacja, `settlementMinutes: 10`.
7. **Publikacja**: raport zapisany w bazie ze stanem i pełnym audytem; strona `/report/[noticeId]`.

### 4.1a Stany raportu i Reppo (moja decyzja po builder-checku)
- Stany: `generating` → `pending_verification` → `verified` | `disputed` | `withheld` | `unverified` (Reppo FAILED lub niedostępne po 3 próbach).
- Raport jest **publiczny od razu po wygenerowaniu** z plakietką "pending independent verification"; Reppo settluje w tle (≥10 min). Nie ukrywamy raportu na czas oceny, bo cel 1 (≤90 s) ma pierwszeństwo nad celem 3; `withheld` zdejmuje raport z publicznego widoku po werdykcie `reject`.
- Reppo: jedna kolejka FIFO (limit 1 pending na konto), worker odpala następną ewaluację po settlemencie poprzedniej.
- **x402 sprzedaje tylko `verified` i `disputed`.** Dla innych stanów endpoint zwraca HTTP 409 z `status` i `retryAfterSeconds`, żeby template Kite (settle tylko przy upstream < 400) **nie pobrał opłaty** za raport, którego nie ma. W demo raporty są wygenerowane i zweryfikowane wcześniej.
- Generacja jest **asynchroniczna**: route handler tworzy rekord `generating` i zwraca id; strona raportu pokazuje postęp kroków (ingest → extract → signals A/B/C → verify → summary) przez polling. Cel 1 doprecyzowany: ≤120 s do stanu `pending_verification` z widocznym postępem.

### 4.1b Ekstraktor: Dolphin vs czas (moja decyzja)
- Dzień 1: test Dolphina z `max_tokens: 3000` i ciaśniejszym promptem (spike mierzył 68–87 s przy 10–12K tokenów wyjścia). Jeśli po strojeniu Dolphin ≤45 s → zostaje primary. Jeśli nie → primary = SERV `gemini-3.1-flash-lite` (9 s), a Dolphin obsługuje tylko "tryb bulk" (załączniki > 100 KB, stretch) i tak jest opisany w write-upie. Decyzja zapisywana w `docs/superpowers/plans/` jako wynik testu dnia 1.

### 4.1c Zakres krajów i języków (moja decyzja)
- Polska jako pierwsza klasa: lista "ostatnie polskie przetargi IT", reguły progów w kategoriach Dyrektywy 2014/24/UE (nie PZP), więc działają w całej UE.
- Spłaszczacz XML zachowuje język ogłoszenia (z `languageID`) + ENG; prompty dostają pole `noticeLanguage`. Inne kraje działają "best effort" z plakietką "non-PL notice: reduced confidence". Brak twardej odmowy.

### 4.2 Sprzedaż per-call (x402)
- Endpoint `GET /v1/report/{noticeId}` w osobnej usłudze Express z template `kite-x402-services` (`PAY_TO`, `KITE_NETWORK=testnet`, `PRICE_USD=0.50`, upstream = nasz Next.js `/api/internal/report/{id}` z sekretem). 402 → płatność → JSON raportu. `/healthz` darmowe.
- Kupujący w demo: `kpass session create --max-amount-per-tx 1 --max-total-amount 5` → zatwierdzenie passkey → `kpass session execute --url .../v1/report/722731-2026`. Pokazujemy `kpass activity` jako dowód zakupu w limitach.
- Jeśli raportu nie ma lub nie jest `verified`/`disputed`, endpoint zwraca 409 (patrz §4.1a), nigdy 2xx, żeby nie pobrać opłaty; w demo raport jest wygenerowany i zweryfikowany wcześniej.
- **Sieć (decyzja właściciela §6.4):** primary = Kite testnet (2368, pieUSD, facilitator Pieverse) z template `kite-x402-services`; buyer = `kpass sandbox on` + faucet pieUSD. Fallback (jeśli nie działa end-to-end do 10 XI) = standardowy x402 na Base mainnet USDC, cena demo $0.05, bo to zakres, który Passport obsługuje natywnie w live mode.
- Stretch: zgłoszenie usługi do katalogu Kite (`services/tenderhound/service.yaml`, PR do `kite-x402-services`).

### 4.3 Stack (moje decyzje)
- TypeScript, Node 26, pnpm, jedno repo: `apps/web` (Next.js App Router, Vercel), `apps/x402` (Express z template Kite, deploy na Vercel jako osobny projekt lub Fly), `packages/core` (pipeline: ingest, extract, signals, verify, score, reppo; zero zależności od frameworka, testowalne Vitest).
- Baza: Neon Postgres + Drizzle, jedna tabela `reports` (noticeId PK, facts JSON, signals JSON, riskScore, summary, status, reppo JSON, audit JSON, costs, timestamps) + `events` (log kroków).
- LLM: wszystko przez SERV (luna), Dolphin tylko do ekstrakcji. Prompty w `packages/core/src/prompts/*.ts` jako stałe z wersją w nazwie (`SIGNALS_A_V1`), bo SERV cache'uje graf po system promptcie.
- UI: Next.js + Tailwind + shadcn; język UI angielski (jury), cytaty w oryginale (polski), streszczenie w angielskim. Strony: `/` (wklej numer lub wybierz z listy), `/report/[id]` (score, 8 sygnałów z cytatami, werdykt Reppo, zakładka Audit: kroki, modele, request-id, koszt), `/api-docs` (jak kupić przez x402, przykład `kpass`).
- Testy: Vitest na `packages/core` z nagranymi odpowiedziami (fixtures z 722731-2026); `pnpm test:live` dla jednego prawdziwego przebiegu.
- Track w zgłoszeniu: **Open Track**, z jawnym użyciem Dolphin + Kite + Reppo w write-upie (pytanie otwarte, patrz §6).

### 4.4 Demo (3 min)
1. Problem w jednym zdaniu, ekran z listą ostatnich polskich przetargów IT z TED.
2. Klik na NBP 722731-2026 → ~60 s → raport: 55/100, BRAND_LOCK "Integracja z Systemem DarkTrace", cytaty, "verified by Reppo".
3. Zakładka Audit: trzy wywołania SERV z request-id, koszt $0.01, 11/11 cytatów zweryfikowanych; konsola OpenServ obok.
4. Terminal: agent z Kite Passport kupuje raport przez x402 za $0.50 w limicie sesji; `kpass activity`.
5. Model przychodu: per-call dla agentów, abonament dla MŚP (poza zakresem), licencja dla mediów.

## 5. Harmonogram

| Dzień | Cel |
|---|---|
| 4 XI | spec zatwierdzony, plan, scaffold monorepo, `packages/core` ingest + extract z fixtures |
| 5–6 XI | macierz sygnałów (3 wywołania), weryfikacja cytatów, scoring, testy |
| 7 XI | Reppo integracja (sandbox), stany verified/disputed/withheld |
| 8–9 XI | Next.js UI: lista, raport, audit; baza; deploy preview |
| 10 XI | x402 service z template Kite, zakup przez `kpass` na testnecie |
| 11 XI | prawdziwa ewaluacja Reppo, 5 raportów referencyjnych, stabilność luny (N≥5 przebiegów) |
| 12 XI | polish UI, README, write-up |
| 13 XI | wideo, post na X |
| 14 XI | zgłoszenie (bufor 1 dzień) |

## 6. Decyzje właściciela (3 XI 2026, wieczór)

1. Track: **Open Track**.
2. Język UI: **angielski**; cytaty w oryginale.
3. Nazwa: robocza "TenderHound", właściciel chce propozycji innych (do ustalenia przed deployem; nie blokuje kodu).
4. Płatność x402: **najpierw Kite testnet** (2368, pieUSD, template `kite-x402-services`, `kpass sandbox on`); **jeśli do 10 XI nie działa end-to-end z Passportem → Base mainnet USDC** (standardowy x402, prawdziwe centy). Test kupującego na `passport.dev.gokite.ai/x402/test` w dniu 1.

## 7. Co zostawiam budowniczemu

- Dokładne reguły progów dla S1/S5/S6 (np. ile dni to "krótki termin" dla procedury otwartej powyżej progu UE: ustawowo 30/35 dni, skrócone 15).
- Format `evidence` (podciąg vs. z numerem sekcji eForms).
- Sposób kolejkowania generacji (synchronicznie w route handlerze z limitem 90 s na Fluid Compute vs. Vercel Queues).
- Szczegóły schematu Drizzle i migracji.
- Wybór facilitatora i sieci, jeśli Kite testnet okaże się niestabilny (fallback: Base Sepolia + standardowy x402).
