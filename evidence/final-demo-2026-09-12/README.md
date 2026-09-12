# Final demo QA evidence — Modern Database Attacks

Date: 2026-09-12
Scope: local Docker deployment, MongoDB-backed secure login, intentionally vulnerable lab login, browser UI, resilience, documentation conversion, and repository tests.

## Result at a glance

| Area | Result |
| --- | --- |
| Docker build/start/seed | PASS |
| Automated unit/security/integration tests | **12/12 PASS** |
| Secure API matrix | **26/26 PASS** |
| Lab API matrix | **29/29 PASS** |
| Production/locality guards | PASS: production `404`, Docker-network request `403` |
| MongoDB down/recovery/app restart | PASS: recovery and restart restored login |
| Browser evidence | PASS: desktop, mobile, success, rejection, injection observation, down/recovery |
| `docs/*.md` to HTML validation | **9/9 PASS** |

This is a reproducible local QA result, not a claim that a production deployment has zero risk.

## Assignment context and exact payload result

The supplied brief asks for a MongoDB-backed login and a NoSQL injection demonstration. This evidence keeps the two payload shapes separate:

- `{"gt":""}` — plain field name; observed `401 INVALID_CREDENTIALS`.
- `{"$gt":""}` — MongoDB comparison operator; observed `200 authenticated: true` on the intentionally vulnerable local lab route.

The secure route rejected both object shapes with `400 INVALID_INPUT`. The vulnerable route is guarded to local lab mode and is unavailable in production. All credentials used here are synthetic lab credentials. No personal credential, token, cookie, or `.env` file is included.

## Environment

- Host Node/npm: `v24.15.0` / `11.12.1`.
- Container Node/npm: `v20.20.2` / `10.8.2`.
- Docker: `28.3.3`; Compose: `v2.39.2-desktop.1`.
- MongoDB image: `mongo:7.0.16`.
- App: `127.0.0.1:3000`; test Mongo mapping: `127.0.0.1:27018 -> 27017`.

## Reproduce

The host had a native MongoDB listener on `127.0.0.1:27017`, so this run used the included port workaround. The native process was not stopped or modified.

```powershell
docker compose -f docker-compose.yml -f evidence/final-demo-2026-09-12/docker-compose.port-workaround.yml up --build -d
docker compose -f docker-compose.yml -f evidence/final-demo-2026-09-12/docker-compose.port-workaround.yml run --rm app node scripts/seed.js --lab
docker compose -f docker-compose.yml -f evidence/final-demo-2026-09-12/docker-compose.port-workaround.yml run --rm -v "${PWD}\tests:/app/tests:ro" app npm run test:all
```

Secure API checks use the default compose file plus the port workaround. Lab API/browser checks add `docker-compose.lab.yml`.

## Artifact index

The JSON/TXT files contain raw command or API output. PNG files are browser screenshots captured after the relevant UI state was visible.

- `01-docker-up.txt` — image build and stack startup.
- `02-compose-ps.txt` — secure container status and health.
- `03-seed.txt` — deterministic synthetic-user seed result.
- `04-automated-tests.txt` — 11 unit/security tests plus 1 real MongoDB integration test.
- `05-api-secure.json` — 26 secure-mode API cases.
- `06-api-lab.json` — 29 lab-mode API cases, including both assignment payload shapes.
- `06-lab-stack.txt` — lab startup, seed, and container status.
- `07-guards.json` — production guard and Docker-network locality guard.
- `08-resilience.json` / `08-resilience.txt` — MongoDB stop, recovery, and app restart.
- `09-database.json` — counts, hash type, plain-password check, and indexes.
- `10-versions.txt` — host/container/runtime versions.
- `11-app-logs.txt` — application logs, runtime user, and crash-pattern scan.
- `12-browser-console.txt` / `12-browser-console-history.txt` — final clean console and expected negative-response history.
- `13-browser-requests*.txt` — browser request list/details/body evidence.
- `14-npm-audit.txt` — dependency audit output.
- `15-docs-html-check.txt` — all nine Markdown documentation pages have valid HTML siblings.
- `16-evidence-integrity.txt` — JSON, report HTML, and PNG readability/signature check.
- `17-final-cleanup.txt` — project containers/network stopped; native MongoDB listener verified untouched.
- `REPORT.html` — standalone visual report with links to the evidence.
- `01-secure-initial.png` — initial secure desktop form.
- `02-secure-success.png` — secure correct credential, HTTP 200.
- `03-secure-wrong-password.png` — secure wrong credential, HTTP 401.
- `04-lab-mode-brief.png` — lab mode with assignment-shaped selector.
- `05-lab-brief-rejected.png` — `{"gt":""}` rejected, HTTP 401.
- `06-lab-operator-success.png` — `{"$gt":""}` observed, HTTP 200.
- `07-mobile-layout.png` — responsive 375×812 browser view.
- `08-mongodb-down.png` — UI reports MongoDB unavailable.
- `09-mongodb-recovered.png` — UI returns to ready state after recovery.

## Findings to be aware of

These were observed and documented, not silently changed during the test run:

1. A native MongoDB process occupied host port `27017`; use the documented `27018` override when reproducing on this machine.
2. `npm audit --omit=dev` reports two moderate transitive `qs` advisories through Express `4.22.2`; no dependency upgrade was made in this QA-only run.
3. The browser requests `/favicon.ico`, which currently returns `404`; this is cosmetic.
4. When MongoDB is stopped, `/api/health` correctly returns `503/database: down`, but authentication requests return generic `500` responses until the database recovers.
5. The Docker image has an empty `Config.User`, so it defaults to the base image user (root); this is a production hardening item.

The intentionally vulnerable lab route is a teaching fixture only. Keep it local, use synthetic data, and do not enable it in production.
