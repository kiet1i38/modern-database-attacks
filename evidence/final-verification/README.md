# Final demo verification

| Check | Result |
| --- | --- |
| Unit and credential-lookup boundary | 25/25 passed |
| HTTP API against real MySQL and MongoDB | 191/191 passed |
| Chromium browser flows | 114/114 passed |
| Application restart and database outage recovery | 12/12 passed |
| Password storage, startup/reset guards, expiry and rate limiting | Passed for all four variants |
| Runtime dependency audit | 0 vulnerabilities |

The browser run captured 134 screenshots at desktop, mobile and tablet sizes. Test scripts exercised real admin authorization after injection, safe rejection before credential lookup, valid-password login after rejection, operator objects versus JSON strings, account locking and ownership checks.

## Changes

- Show password type, credential-query execution and the recognized Mongo predicate in diagnostics; rejected requests receive a diagnostic too.
- Hide the preset preview when custom input is selected.
- Add boundary and regression checks, including proof that safe validation does not call credential lookup.
- Patch body-parser and qs within existing dependency ranges.
- Correct the stale status/code walkthrough and put MongoDB first in the existing presentation guide. No separate Q&A page was retained.
- Use a two-second test session so slow database round trips do not expire the CSRF session before login; the application default remains 30 minutes.

## Evidence

[API assertions](api-results.json), [browser assertions](browser-results.json), [recovery assertions](resilience-results.json), [additional database checks](storage-guards-expiry.log), [unit log](unit-tests.log), [dependency audit](dependency-audit.log).

[Successful Mongo operator bypass](mongo-unsafe-payload-gt-admin-session.png), [safe rejection before lookup](mongo-safe-payload-gt-blocked.png), [literal JSON string rejected](mongo-safe-stringified-operator-denied.png).

## Reproduction

Use the project README for a clean checkout. This machine's verification stack uses the separate Compose project `campusdesk-review`, preserving other project volumes. To manage this running stack use `docker compose -p campusdesk-review ...` from the repository directory. Test cases create synthetic QA data.

The browser harness is scripts/browser-campus.js. It was run with an isolated Playwright Chromium headless build; the existing Playwright CLI workflow can also invoke it. The regular Brave profile was not used. Session expiry was tested with a shortened two-second lifetime, not by waiting the default 30 minutes. No Firefox/Safari, high-load or production-security assurance is claimed.

Final handoff: all four services are healthy and their synthetic data was reset to the original seed, with 12 tickets per variant. The separate Q&A page returns 404. See final-clean-state.log.
