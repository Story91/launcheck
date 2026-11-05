# Demo script (3 minutes)

Before recording: the SAM.gov import has run on production; five US reports pre-generated and through Reppo (start with the NASA "HID ID/Access Cards" solicitation, notice `3aeff044414241b595f6a5752d18e242`, if it is still open; otherwise the open IT notice with the highest score); x402 service deployed; `kpass` logged in with an approved session; OpenServ console open in a second tab; `packages/core/eval/results/LATEST.md` open.

| Time | Screen | Say |
|---|---|---|
| 0:00–0:20 | Home page, open federal IT solicitations | "Thousands of federal solicitations are posted on SAM.gov every week. Before a small business spends days on one, it wants to know: is this written around a single supplier? Tendr reads it for you." |
| 0:20–0:40 | Click the NASA notice | "Every morning Tendr imports the public SAM.gov extract, no API key, about twelve thousand active solicitations. Generating a report takes about 30 seconds; you can watch the steps: extraction, three SERV reasoning calls, quote verification, summary." |
| 0:40–1:15 | Report page: risk meter, summary, S2 | "The brand signal fired: the notice says 'THIS IS A BRAND NAME REQUIREMENT' and 'AUTHORIZED RESELLERS ONLY'. Under FAR 11.104 that limits competition to one manufacturer's channel. Every quote is verified by code to appear verbatim in the notice; a quote that is not in the source is dropped, and the flag with it. Small-business set-asides are lawful and never flagged." |
| 1:15–1:40 | Audit tab, then OpenServ console | "The audit trail: model, prompt version, SERV request id, tokens, cost. gpt-6-luna, the cheapest model, with multipath reasoning graphs and a shadow agent enforcing verbatim quotes. About a cent per report. Same ids in the OpenServ console." |
| 1:40–2:05 | LATEST.md: GAO evaluation table | "Does it judge correctly? We tested it on GAO bid-protest decisions. Every time it flagged, it was right, and it raised no false alarms on clean solicitations. It caught a third of the sustained protests. The misses need information the text does not contain, and we say so." |
| 2:05–2:25 | Status badge, Reppo critique | "Before a report is called verified, independent judges on Reppo review it. Accept, revise or reject: verified, disputed, withheld." |
| 2:25–2:50 | Terminal: `kpass session execute` → 402 → JSON; `kpass activity` | "An agent buys the report over x402 with a Kite Agent Passport, inside the spending limit its owner approved. An unverified report returns 409 and is never charged." |
| 2:50–3:00 | Home page | "Per-report sales to agents, subscriptions for small businesses by NAICS code, licences for newsrooms and watchdogs. Tendr, Open Track." |
