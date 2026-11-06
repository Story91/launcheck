# Deployed acceptance — 6 November 2026

These are real executions against our own demonstration page, not fixtures.

| Run | Report | Settled vendor charges | Result |
| --- | --- | ---: | --- |
| Broken demo | [Receipt](https://tendr-ecru.vercel.app/check/lc_9b00787167ca2371f7ac07a3) | 0.015 USDC | 8 completed checks, 10 findings, 3 unperformed checks |
| Fixed demo, owner rerun | [Receipt](https://tendr-ecru.vercel.app/check/lc_KpScNuw45vmP) | 0.020 USDC | 10 completed checks, 4 remaining findings, 1 unperformed check; 6 of the previous 10 fixed |

Both runs made two actual SERV requests, with request IDs retained in their audits. The first plan chose browser navigation and a narrow screenshot, skipping desktop and the HTML second opinion. The second chose navigation plus both screenshots. All five purchases settled from the owner allowance in USDC on Base, with distinct transaction hashes.

The purchased browser actually clicked Pricing: HTTP 404 before the fix, then the repaired pricing anchor after the fix. No forms, sign-in or checkout were tested. Fixes included missing social tags, viewport, long title and the pricing link. Remaining DNS/header observations were retained, not hidden to create a clean report.

`acceptance-integrity.json` records byte/hash verification for five stored PNGs, receipt sums and actual downloadable receipt PNGs. Original run JSON is retained under `.hallmark/acceptance-{before,after}.json`. No session connection URL, token or creator cookie is included.

The live test also prompted conservative follow-ups: incomplete link sampling must not imply a fix; missing mail DNS does not establish that a website sends email from its hosting hostname; current app response headers were improved. Historical reports remain timestamped observations of the earlier response.

Public-spending configuration: the owner explicitly approved 1.50 USD/day through 15 November 23:59 UTC. It is separate from Kite's owner allowance and vendor charge reconciliation. SERV token/add-on charges are separate from the USDC receipt.

The Base-USDC LaunchCheck seller remains planned. Repository visibility, final hackathon submission and public social posting are separate from application deployment; this acceptance record does not claim they happened.
