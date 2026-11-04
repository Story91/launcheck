# Demo script (3 minutes)

Before recording: five reports pre-generated and verified (NBP 722731-2026 + four from the home list), x402 service deployed, `kpass` logged in with an approved session, OpenServ console open in a second tab.

| Time | Screen | Say |
|---|---|---|
| 0:00–0:20 | Home page, list of live TED notices | "Public tenders are published every day. Before a company spends a week on one, it wants to know whether the notice is written around a single supplier. Tendr reads it for you." |
| 0:20–0:40 | Click NBP notice | "This is a live notice from the Polish central bank, 3.16 million zloty. Generating takes about 30 seconds; you can watch the steps: TED, extraction, three SERV calls, quote verification, summary." |
| 0:40–1:20 | Report page: risk meter, summary, S2 high | "Risk 30 of 100. The high signal: the notice requires integration with a named system, DarkTrace, and has no equivalence clause. Every quote is in Polish because it is copied from the notice and verified by code to be verbatim. A quote that is not in the source is dropped, and the flag with it." |
| 1:20–1:50 | Audit tab, then OpenServ console | "This is the audit trail: model, prompt version, SERV request id, tokens, cost. gpt-6-luna, the cheapest model, with multipath reasoning graphs and a shadow agent enforcing verbatim quotes. Whole report: one cent. Same ids in the OpenServ console." |
| 1:50–2:15 | Status badge "Verified by Reppo", critique | "Before we call it verified, independent judges on Reppo review it against three criteria. Accept, revise or reject: verified, disputed, withheld." |
| 2:15–2:50 | Terminal: `kpass session execute` → 402 → JSON; `kpass activity` | "An agent buys the report over x402 with a Kite Agent Passport, inside the spending limit its owner approved with a passkey. An unverified report returns 409 and is never charged." |
| 2:50–3:00 | Home page | "Per-report sales to agents, subscriptions for bidders, licences for newsrooms. Tendr, Open Track." |
