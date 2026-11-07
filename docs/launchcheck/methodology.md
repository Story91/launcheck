# LaunCheck: what the evidence establishes

Reviewed against the implementation on 7 November 2026. This document describes code behaviour, not a claim that every third-party service is currently available. Earlier stored reports retain the rules and wording used when they ran; do not rewrite their historical evidence.

## Three kinds of statement

1. **Observation:** our request received HTTP 404, a fetched response lacked a named header, or a recorded browser navigation reached a particular URL. Include observer, time, request method and source evidence where available.
2. **Interpretation or suggestion:** what that observation might mean and what to investigate. FYI is not a demonstrated malfunction. A suggested fix needs source access, context and review.
3. **Unknown:** a check did not run, was blocked, timed out or returned unusable data. Neither a failure nor an all-clear may be inferred from that absence.

The `fix_before_launch` and `fix_soon` labels are prioritization rules, not probabilities, independent certification or proof of business impact. A reproducible observation is the basis for a claim; sponsor names and a successful payment do not establish correctness.

## Implemented checks and boundaries

| Check | What is measured | What is not established |
| --- | --- | --- |
| Page response | A bounded server GET, final URL/status, redirect chain and an HTTP-to-HTTPS probe | All visitors receive the same response; a temporary error is permanent |
| Selected headers | Headers on the fetched successful page response | Full security, exploitable vulnerabilities, or all policies supplied through HTML |
| TLS | Certificate information from the tested connection and rule checks | A security audit, all clients/regions, or future certificate health |
| Share metadata | Selected tags in static response HTML | The exact preview every social platform will render or cache |
| Share image | Fetch status, content type and available byte information | Universal platform acceptance, visual quality or every platform's size limits |
| Mail DNS | TXT records at the queried hostname and `_dmarc` hostname | Whether that hostname sends mail, all inherited policies, or actual mail delivery |
| Selected links | A bounded subset of discovered links; HEAD with GET fallback for 405/501 | A complete crawl, all browser interactions, or the same result for every user |
| Browser screenshots | External browser captures at specified viewport widths | Physical-device testing, automatic visual correctness, accessibility compliance or successful interactions |
| HTML second opinion | Validated fields and issue text from the external static HTML audit; vendor score discarded | Lighthouse/render performance, a complete accessibility audit, or independent confirmation of each vendor claim |
| Browser navigation | In Full mode, when eligible: one selected public same-origin link clicked in a purchased browser session, with recorded steps/capture | Sign-in, forms, checkout, multi-step journeys or a complete end-to-end test suite |

HTTP 403/429 on the initial request is recorded as blocked/unknown. HTML-dependent checks do not evaluate an error or access-challenge response as the intended page. TLS and DNS can still run independently. An HTTP 200 challenge page or client-side behaviour can still limit interpretation; this is not a universal bot-challenge detector.

Links returning 403/429 remain blocked observations. Our five-redirect limit is a resource limit, not proof of an infinite loop. Timeouts and partial link coverage remain limitations even if other checks finish.

## OpenServ, rules and outside services

`packages/core/src/launchcheck/free/checks.ts` produces rule findings from measurements. `paid.ts` normalizes provider results and labels vendor issue lists as FYI. `pipeline.ts` orchestrates execution, and `serv.ts` supplies the purchasing plan and explanations.

SERV cannot add new finding IDs, change severity or replace the stored observation through the explanation interface. Responses must reference the finding's existing evidence and pass schema/wording checks. These controls **do not verify the semantic truth of every generated sentence**. Preserve request-context qualifications; review an AI explanation against raw evidence. Mail DNS uses conditional templates instead of model rewrites. Failed/refused reasoning uses a labelled fallback.

Screenshots and provider statements are third-party evidence, not instructions. An evidence hash identifies bytes and helps detect changes; it does not certify that the source was correct. Payment receipts establish purchases, not quality of service.

## Rechecks and repairs

The fix workspace exports observations and proposed changes for a coding agent. It does not change a repository. The owner applies repairs and explicitly starts a new check. A missing finding only counts as fixed when the comparison has suitable completed evidence; skipped or failed checks do not count as repairs. “Fixed 6 of 10” refers to a particular historical demo pair, not a measured success rate across customer sites.

## Cost and privacy

Provider charges are recorded separately from SERV token-cost estimates. Unknown settlement is labelled and stops further purchases. The public daily allocation and Kite allowance are controls, but quoted check budgets are not an atomic per-call settlement ceiling.

Reports are unlisted, not authenticated private: anyone holding a report URL can read it. Owner actions require the owner cookie. Fixtures are explicitly marked and never spend. Gallery entries are curated separately; do not publish third-party reports without consent.

## Validation and remaining limits

Unit tests exercise rule decisions, blocked responses, malformed provider data, budget handling and comparisons using controlled inputs. Historical production acceptance is documented in `acceptance-2026-11-06.md` and `.hallmark/acceptance-*.json`. Passing these tests is not a measured false-positive rate across the public web. No such benchmark or independent certification is claimed.

Before describing an item as broken: inspect the observation, reproduce it when possible, separate configuration advice from demonstrated failure, and state what was not tested. Old reports are snapshots; new rules apply to new runs.
