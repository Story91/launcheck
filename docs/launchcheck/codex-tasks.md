# Brief dla Codex: LaunchCheck UI (od 7 XI 2026)

Wklej to w całości. Spec: `docs/superpowers/specs/2026-11-06-launchcheck-design.md` (przeczytaj sekcje 1, 3, 4, 7, 10). Koordynacja: `docs/coordination.md`.

## Twoja rola
Odpowiadasz za UI/UX i frontend LaunchCheck w `apps/web`:
- wdrożenie marki i tokenów (z `docs/brand/style-guide.md`),
- strony i komponenty, stany puste, błędów i "unknown",
- OG image i badge, udostępnianie na X,
- mobile 390 px i dostępność,
- wdrożenie poprawek copy po brand-review.

Claude odpowiada za backend: `packages/core`, trasy API, integrację kpass/Kite, prompty SERV, schemat DB, x402, `vercel.json`, `next.config.ts`.

Next.js 16 ma zmiany łamiące wsteczną zgodność. Przed pisaniem przeczytaj `apps/web/AGENTS.md` i odpowiednie przewodniki w `node_modules/next/dist/docs/` (opengraph-image, route handlers, metadata).

## Pliki, które są TWOJE
- `apps/web/src/app/page.tsx` (landing LaunchCheck)
- `apps/web/src/app/layout.tsx`, `apps/web/src/app/globals.css`
- `apps/web/src/app/check/[id]/**` (`page.tsx`, `opengraph-image.tsx`, `loading.tsx`, `not-found.tsx`)
- `apps/web/src/app/badge/[id]/route.ts` (SVG)
- `apps/web/src/app/gallery/**`, `apps/web/src/app/agents/**`
- `apps/web/src/app/api-docs/page.tsx` (zamień na redirect do `/agents`)
- `apps/web/src/app/demo/acme-launch/**` (strona demo z podłożonymi problemami)
- `apps/web/src/app/tendr/**` (przeniesiony marketplace Tendr)
- `apps/web/src/components/launchcheck/**` (wszystkie nowe komponenty, `copy.ts`, `copy.test.ts`, `format.ts`)
- istniejące komponenty Tendr w `apps/web/src/components/*.tsx`: tylko przenoszenie i importy, bez zmian logiki
- `apps/web/public/**`
- `docs/coordination.md`: tylko dopisywanie w sekcji "Requests from Codex"

## Pliki, których NIE dotykasz
- `packages/**` (w tym `packages/core/src/launchcheck/types.ts`, fixtures, prompty)
- `apps/web/src/app/api/**`, `apps/web/src/lib/**` (db, launchcheck, deps, store)
- `apps/web/next.config.ts`, `apps/web/scripts/**`, `apps/web/drizzle.config.ts`, każdy `package.json`, `pnpm-lock.yaml`
- `apps/x402/**`, `apps/runner/**`, `vercel.json`, `.env*`
- `docs/**` poza `docs/coordination.md`
- `apps/web/src/app/report/[id]/**` (Tendr, zostaje jak jest)

Potrzebujesz zależności (np. fontu do OG), nowego pola w API albo zmiany typu? Dopisz prośbę w `docs/coordination.md` → "Requests from Codex" i kontynuuj na mocku. Claude odpowie tam.

## Kontrakt (co konsumujesz)
Typy importuj z `@tendr/core` (`import type { Report, AgentStatus, Catalog, GalleryItem } from "@tendr/core"`). Zod schematy z tym samym kontraktem leżą w `packages/core/src/launchcheck/types.ts` (zamrożone koniec 7 XI).

**Tryb fixtures działa od dnia 1 na prawdziwych trasach:**
- `GET /api/checks/fx_problems`, `fx_clean`, `fx_unreachable`, `fx_running` (przy każdym GET postęp idzie dalej, symuluje live), `fx_fixed` (ma `diff`)
- `GET /api/agent?fixture=1`, `GET /api/catalog`, `GET /api/gallery?fixture=1`

Twórz UI na tych id, zanim ruszy prawdziwe API.

### `GET /api/catalog`
```json
{
  "tiers": [
    {"id":"quick","budgetUsd":0.05,"label":"Quick"},
    {"id":"standard","budgetUsd":0.15,"label":"Standard","default":true},
    {"id":"full","budgetUsd":0.25,"label":"Full"}
  ],
  "checks": [
    {"checkId":"page_fetch","label":"Page response","kind":"free","priceUsd":0},
    {"checkId":"render_desktop","label":"Desktop render (1280px)","kind":"paid","priceUsd":0.005,"vendorHost":"web.cyberwarex.com","tiers":["quick","standard","full"]},
    {"checkId":"html_audit","label":"Static HTML audit","kind":"paid","priceUsd":0.08,"vendorHost":"api.kadec0.xyz","tiers":["standard","full"]}
  ]
}
```

### `POST /api/checks`
Request: `{"url":"https://acme.dev","tier":"standard","venue":"product_hunt"}` (`venue`: `product_hunt|show_hn|x|other`).
- `201 {"id":"lc_7Hq2x9KpLm","reportUrl":"/check/lc_7Hq2x9KpLm","cached":false}`. Ustawia cookie z tokenem twórcy.
- `200 {"id":"…","reportUrl":"…","cached":true,"checkedAt":"2026-11-12T11:02:00Z","rerunEstimateUsd":0.11}`
- Błędy:
  - `400 {"error":"invalid_url"}`
  - `403 {"error":"blocked_url","reason":"private_address"}`
  - `429 {"error":"rate_limited","retryAfterSec":3600}`
  - `503 {"error":"live_runs_paused","reason":"daily_cap|executor_offline|paused|allowance_low","galleryUrl":"/gallery"}`

### `GET /api/checks/[id]` → `Report`
Odpytuj co 2 s, dopóki `status` nie jest `done|failed|unreachable`.
```json
{
  "id":"lc_7Hq2x9KpLm","url":"https://acme.dev/","origin":"https://acme.dev",
  "status":"done","progress":"done","tier":"standard","mode":"allowance",
  "budgetUsd":0.15,"spentUsd":0.107,"createdAt":"2026-11-12T14:01:40Z","finishedAt":"2026-11-12T14:03:05Z",
  "parentId":null,"isRequester":true,"cached":false,
  "summary":{"checksRun":11,"problems":3,"nothingFound":7,"notChecked":1},
  "plan":{
    "buy":[{"checkId":"render_desktop","label":"Desktop render (1280px)","vendorHost":"web.cyberwarex.com","priceUsd":0.005,"reason":"Shows what a first-time visitor sees above the fold."},
           {"checkId":"html_audit","label":"Static HTML audit","vendorHost":"api.kadec0.xyz","priceUsd":0.08,"reason":"Independent second opinion on your HTML."}],
    "skip":[{"checkId":"render_clean","label":"Render with popups hidden","priceUsd":0.02,"reason":"Over budget after the essentials."}],
    "plannedUsd":0.11,"chosenBy":"agent"
  },
  "checks":[
    {"checkId":"share_tags","label":"Link preview tags","kind":"free","state":"problem","notCheckedReason":null,"evidenceIds":["ev_share"],"scopeNote":"Static HTML only"},
    {"checkId":"render_narrow","label":"Narrow render (390px)","kind":"paid","state":"clear","notCheckedReason":null,"evidenceIds":["ev_390"],"scopeNote":"390px-wide browser window. Not a phone: no touch, no mobile user agent, no device emulation."},
    {"checkId":"outside_probe","label":"Links checked from outside","kind":"paid","state":"not_checked","notCheckedReason":"vendor_error","evidenceIds":[],"scopeNote":null}
  ],
  "evidence":[
    {"id":"ev_1280","checkId":"render_desktop","kind":"image","label":"Desktop render","blobUrl":"https://…blob.vercel-storage.com/lc/…/1280.png","sha256":"9f2c…","capturedAt":"2026-11-12T14:02:11Z","source":{"type":"paid","vendorHost":"web.cyberwarex.com","endpoint":"/screenshot"},"scopeNote":"Rendered by cyberwarex's headless browser","fields":{"width":1280}},
    {"id":"ev_share","checkId":"share_tags","kind":"json","label":"Link preview tags","blobUrl":null,"sha256":"1ab0…","capturedAt":"2026-11-12T14:01:45Z","source":{"type":"free","vendorHost":null,"endpoint":null},"scopeNote":"Our mock of the card from your tags; X and LinkedIn crop differently","fields":{"ogTitle":"Acme: ship faster","ogDescription":null,"ogImage":null,"twitterCard":null,"title":"Acme","titleLength":4}}
  ],
  "findings":[
    {"id":"f_og_image_missing","ruleId":"og_image_missing","checkId":"share_tags","severity":"fix_before_launch","title":"Link preview has no image","observed":"No og:image tag on https://acme.dev/","evidenceIds":["ev_share"],"explanation":"When you post this link on X or LinkedIn, the card will show no picture.","fix":"Add <meta property=\"og:image\"> with a 1200x630 image.","explainedBy":"serv"},
    {"id":"f_link_404_1","ruleId":"link_broken","checkId":"link_status","severity":"fix_before_launch","title":"Broken link: /pricing","observed":"HTTP 404 for https://acme.dev/pricing","evidenceIds":["ev_links"],"explanation":"…","fix":"…","explainedBy":"template"}
  ],
  "receipt":{
    "lines":[
      {"n":1,"checkId":"render_desktop","label":"Desktop render","vendorHost":"web.cyberwarex.com","endpoint":"/screenshot","quotedUsd":0.005,"paidUsd":0.005,"source":"allowance","status":"paid","httpStatus":200,"txHash":"0x8c1e…","explorerUrl":"https://basescan.org/tx/0x8c1e…","idempotencyKeyShort":"3f9a","at":"2026-11-12T14:02:11Z","substitutedFor":null},
      {"n":5,"checkId":"render_clean","label":"Render with popups hidden","vendorHost":"screenshots.underscoredone.com","endpoint":"/capture","quotedUsd":0.02,"paidUsd":0,"source":"allowance","status":"skipped_budget","httpStatus":null,"txHash":null,"explorerUrl":null,"idempotencyKeyShort":null,"at":"2026-11-12T14:02:40Z","substitutedFor":null}
    ],
    "totalPaidUsd":0.107,"budgetUsd":0.15,"stoppedBy":null,"freeChecks":7
  },
  "agent":{"kiteAgentId":"…a41f","agentType":"claude","ownerMasked":"st***@…","network":"Base mainnet (eip155:8453)","asset":"USDC"},
  "audit":[{"step":"plan","model":"gpt-6-luna","promptVersion":"launchcheck-plan.v1","requestId":"req_…","consoleUrl":"https://…","inputHash":"…","costUsd":0.0021,"droppedItems":0,"refused":false}],
  "notChecked":["Rendering speed","Accessibility in a real browser","Real phones and tablets","Security beyond the listed headers","Pages other than the one you entered","Links beyond the first 10"],
  "diff":null
}
```
Dopuszczalne wartości:
- `receipt.lines[].status`: `paid|skipped_budget|failed_not_charged|failed_charged|payment_unknown|refused_by_kite`
- `stoppedBy`: `null|our_cap|kite_policy|allowance_empty`
- `notCheckedReason`: `over_budget|vendor_error|timeout|payment_unknown|not_applicable|kite_refused|blocked_from_our_server`
- `status` runu: `queued|prechecking|planning|buying|explaining|done|failed|unreachable`

Przy `fx_fixed`:
```json
"diff":{"parentId":"lc_7Hq2x9KpLm","parentCheckedAt":"…","fixed":["f_og_image_missing","f_link_404_1"],"stillThere":["f_dmarc_missing"],"new":[]}
```

### Pozostałe trasy
- `POST /api/checks/[id]/rerun` → `201 {"id":"…","reportUrl":"…","estimateUsd":0.03}` (tylko gdy `isRequester`)
- `DELETE /api/checks/[id]` → `204`
- `GET /api/agent` → `AgentStatus`:
```json
{"agent":{"kiteAgentId":"…a41f","agentType":"claude","ownerMasked":"st***@…","registeredAt":"2026-11-06"},
 "allowance":{"leftUsd":6.42,"limitUsd":10,"period":"weekly","resetsAt":"2026-11-13T01:33:00Z","readAt":"2026-11-12T14:00:10Z"},
 "demo":{"capUsd":1.5,"leftUsd":1.12,"resetsAt":"2026-11-13T00:00:00Z"},
 "executor":{"online":true,"lastSeenAt":"2026-11-12T14:00:05Z","where":"vercel"},
 "liveRuns":true}
```
- `GET /api/gallery` → `{"items":[{"id":"…","origin":"https://acme.dev","checkedAt":"…","summary":{…},"spentUsd":0.107,"thumbUrl":"…","fixed":false}]}`
- Strona demo: `import { getDemoFixed } from "@/lib/launchcheck/demo"` (Claude dostarcza dzień 4; do tego czasu stała `false`).

## Zadania

1. **Przeniesienie Tendr i nawigacja (dzień 1).** Marketplace Tendr z `/` przechodzi na `/tendr`, a jego komponenty działają bez zmian logiki. Nawigacja w `layout.tsx`: LaunchCheck, Gallery, For agents. Metadata layoutu przechodzi na LaunchCheck.
   *Akceptacja:* `/tendr` renderuje się jak dawny `/`. Testy web zielone (zaktualizuj importy w istniejących testach Tendr tylko jeśli ścieżki się zmieniły). Brak linków do Tendr w nav.
2. **Landing `/` (dzień 1–2).** Pole URL, select venue, picker budżetu z `/api/catalog` (pokazuje, co dany stop kupuje i za ile), zdanie obietnicy, `AgentCard` z `/api/agent` (tożsamość, meter allowance z `readAt`, cap demo, online/offline), pas galerii, link "For agents".
   Stany: `invalid_url`, `blocked_url`, `rate_limited` (z czasem), `live_runs_paused` per reason (z linkiem do galerii), `executor offline`, cache hit (przekierowanie z banerem).
   *Akceptacja:* działa na `?fixture=1` i na prawdziwym API. Wszystkie stany z mocka mają widok. Brak zakazanych słów.
3. **Raport `/check/[id]` (dzień 2–3).** Kolejność:
   - nagłówek z liczbami ("We ran N checks. Found X problems. Y couldn't run.") i wiek wyniku,
   - `ScreenshotPair` (1280 + 390 w ramce telefonu z etykietą zakresu),
   - `FindingCard` pogrupowane wg `severity` (Fix before launch / Fix soon / FYI), każda z dowodem i "view raw",
   - `CheckList` z 3 stanami (problem / nothing found / couldn't check + powód; "couldn't check" neutralny szary, nigdy zielony),
   - `NotCheckedBox` (zawsze widoczny),
   - `PlanPanel` (buy/skip z powodami, `chosenBy`),
   - `LiveReceipt` (styl paragonu, monospace dla kwot, tx hash z linkiem basescan, statusy linii, stopka "Spent $X of $Y · N skipped · M free checks", `stoppedBy` podpisany warstwą),
   - `AgentIdentityBlock`,
   - `AuditDrawer` (request id, model, promptVersion, koszt, droppedItems, link do konsoli),
   - `ShareBar`.
   *Akceptacja:* `fx_problems`, `fx_clean`, `fx_unreachable`, `fx_fixed` renderują się poprawnie. Przy `fx_clean` nagłówek "Found 0 problems in 11 checks", lista "Nothing found" ze screenshotami, bez słów typu "passed".
4. **Live progress (dzień 3).** Polling 2 s. Kafelki checków przechodzą z pending w running i w stan końcowy. Linie paragonu "osiadają" po kolei z animacją (z `prefers-reduced-motion` bez animacji), licznik budżetu tyka w dół. Przy `failed` komunikat z `error`.
   *Akceptacja:* `fx_running` przechodzi pełną sekwencję bez przeładowania; brak skoków layoutu.
5. **OG Launch Receipt + Fixed (dzień 4).** `/check/[id]/opengraph-image.tsx` (ImageResponse, 1200×630):
   - nagłówek z originem, datą UTC i agent id,
   - 4–6 linii paragonu,
   - "Spent $X of $Y",
   - miniatura 390 px,
   - liczby problemów,
   - pasek "Paid for by an AI agent · N paid calls · Kite Passport".
   Wariant Fixed, gdy `diff` istnieje: "Fixed X of Y problems LaunchCheck found" i daty obu runów. Do tego `generateMetadata` w `page.tsx`, z `noindex` dla raportów.
   *Akceptacja:* PNG generuje się dla wszystkich fixtures w < 3 s lokalnie. Brak score, "verified", "safe", "ready".
6. **Udostępnianie (dzień 4).** `ShareBar`: "Share on X" (intent z prefill z `copy.ts`, osobny tekst dla Fixed), "Copy link", "Copy badge" (Markdown + HTML), "Check again after fixing" (tylko `isRequester` i `problems>0`, wywołuje rerun i przekierowuje), "Remove this report" (DELETE, z potwierdzeniem).
   *Akceptacja:* prefill bez zakazanych słów; rerun i delete działają na prawdziwym API.
7. **Badge `/badge/[id]` (dzień 4–5).** SVG: "LaunchCheck · N checks · 12 Nov 2026 · see receipt". Szary z tekstem "Results older than 30 days", gdy raport ma więcej niż 30 dni. Nagłówki cache 1 h.
   *Akceptacja:* oba warianty wyglądają poprawnie na jasnym i ciemnym tle README GitHuba.
8. **Strona demo `/demo/acme-launch` (dzień 4).** Fikcyjny landing "Acme". Gdy `getDemoFixed()===false`, ma:
   - **brak** og:image i twitter:card (metadata trasy nadpisuje layout, sprawdź w HTML!),
   - brak meta viewport (layout rozjeżdża się w 390 px),
   - link w nav do `/demo/acme-launch/pricing`, który zwraca 404,
   - title dłuższy niż 60 znaków.
   Gdy `true`, wszystkie te problemy są naprawione. Strona ma widoczny dopisek "Demo page with deliberate problems, used by LaunchCheck's demo".
   *Akceptacja:* `curl` HTML pokazuje brak og:image/viewport w trybie broken i ich obecność w trybie fixed.
9. **`/gallery` i `/agents` (dzień 5).**
   - `/gallery`: karty z miniaturą, liczbami, kwotą, oznaczeniem Fixed i wiekiem.
   - `/agents`: endpoint `GET /v1/launchcheck?url=&tier=`, ceny ($0.19/$0.39/$0.59, re-run połowa), gotowa komenda `kpass session execute …`, przykład odpowiedzi 202 i JSON z pollUrl, instalacja skilla, snippet GitHub Action (jako przykład), uczciwa notka o stanie sieci płatności (tekst od Claude w `coordination.md`).
   - `/api-docs` przekierowuje na `/agents`.
   *Akceptacja:* treść zgodna z kontraktem; brak obietnic, których backend nie spełnia.
10. **Copy centralnie (dzień 1+).** Wszystkie stringi UI LaunchCheck w `components/launchcheck/copy.ts`. `copy.test.ts` importuje `BANNED_WORDS` z `@tendr/core` i failuje przy wystąpieniu (word-boundary, wyjątek "security headers").
    *Akceptacja:* test zielony; brak stringów UI zaszytych w JSX poza `copy.ts`.
11. **Marka (dzień 2, po `docs/brand/style-guide.md`).** Tokeny w `globals.css`: kolory, typografia, monospace kwot, stany (problem / nothing found / couldn't check), focus ring. Zachowaj działanie stron Tendr.
    *Akceptacja:* kontrast AA dla tekstu i stanów; strony Tendr nadal czytelne.
12. **Mobile i a11y (dzień 5–6).** Wszystkie strony przy 390 px bez poziomego scrolla. Paragon czytelny na telefonie. Obrazy z alt opisującym dowód. Szuflady i przełączniki obsługiwane z klawiatury, `aria-live` dla postępu.
    *Akceptacja:* ręczny przegląd 390 px i 1280 px; brak błędów a11y w podstawowym audycie przeglądarki.
13. **Poprawki po brand-review (dzień 6–7).** Wdróż listę z `docs/brand/brand-review-2026-11-12.md` (każda pozycja odhaczona w commit message lub w `coordination.md`).
    *Akceptacja:* wszystkie pozycje critical/major zamknięte do 13 XI 12:00 UTC.
14. **Polish do wideo (dzień 7).** Mikrointerakcje paragonu, stany ładowania, favicon/ikona LaunchCheck, OG strony głównej (nasza własna karta).
    *Akceptacja:* feature freeze 13 XI 18:00 UTC, później tylko poprawki błędów.

## Zasady commitów
- Conventional Commits po angielsku (`feat(web): …`, `fix(web): …`, `style(web): …`). Autor: **Story91** (lokalny `git config user` już to ustawia). **Bez linii Co-Authored-By i bez wzmianek o AI.**
- Małe commity, jeden temat. Commitujesz tylko pliki ze swojej listy własności.
- Przed każdym commitem: `pnpm --filter @tendr/web test && pnpm --filter @tendr/web typecheck` (i `pnpm lint`, jeśli zdefiniowany).
- Praca na `main`: przed pushem `git pull --rebase`, nigdy `--force`. Deploy produkcyjny robi tylko Claude.
- Nigdy nie commituj `.env` ani sekretów. Nie zmieniaj zależności sam: prośba w `coordination.md`.

## Punkty synchronizacji
- **S1, 7 XI wieczorem:** Claude dostarcza zamrożony `types.ts`, fixtures, tryb fixtures API i `docs/brand/style-guide.md`. Ty: szkielety `/`, `/check/[id]`, `/tendr`.
- **S2, 9 XI:** prawdziwe `POST/GET /api/checks` na preview. Przełączasz się z fixtures na realne id.
- **S3, 10 XI:** prod E2E. OG, share, badge i demo gotowe do testu na prawdziwym runie.
- **S4, 12 XI:** lista poprawek z brand-review.
- **S5, 13 XI 18:00 UTC:** feature freeze.
- **S6, 14 XI:** nagranie wideo; dyżur na poprawki.
