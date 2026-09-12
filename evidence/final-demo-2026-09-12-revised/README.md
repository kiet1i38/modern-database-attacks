# Final demo QA evidence — revised operator catalog

Date: 2026-09-12

Scope: local Docker deployment, MongoDB-backed secure login, isolated lab login, six documented MongoDB operator payloads, browser UI, guardrails, resilience, database state, documentation conversion, and repository tests.

## Result at a glance

| Area | Result |
| --- | --- |
| Docker build/start/seed | PASS |
| Tests executed in the app container | **13/13 PASS** |
| Secure API matrix | **28/28 PASS** |
| Lab API matrix | **32/32 PASS** |
| Production and Docker-network guards | PASS: `404` / `403` |
| MongoDB down/recovery and app restart | PASS |
| Browser evidence | PASS: 14 PNG screenshots |
| Markdown-to-HTML documentation check | **9/9 PASS** |

This is reproducible local QA evidence, not a claim that a production deployment has zero risk.

## Assignment result

The final demo now uses real MongoDB dollar-prefixed operator shapes in the intentionally vulnerable, loopback-only lab route:

| Operator | Demonstration payload | Observed result |
| --- | --- | --- |
| `$gt` | `{ "$gt": "" }` | `200`, authenticated |
| `$gte` | `{ "$gte": "" }` | `200`, authenticated |
| `$ne` | `{ "$ne": "not-the-password" }` | `200`, authenticated |
| `$regex` | `{ "$regex": ".*" }` | `200`, authenticated |
| `$nin` | `{ "$nin": ["not-the-password"] }` | `200`, authenticated |
| `$exists` | `{ "$exists": true }` | `200`, authenticated |

The secure route accepts scalar passwords only and rejected all six object shapes with `400 INVALID_INPUT`. The lab validator accepts exactly the six bounded operators above; unsupported operators such as `$where`, multiple operator keys, wrong value types, oversized lists, arrays, and malformed JSON were rejected. Negative semantic checks for each operator were also included in the lab API matrix and returned `401`.

All credentials and database rows are synthetic. The lab route is never enabled by the default compose file, is disabled in production mode, and rejects non-loopback requests.

## Environment

- Host Node/npm: `v24.15.0` / `11.12.1`
- Container Node/npm: `v20.20.2` / `10.8.2`
- Docker: `28.3.3`
- Docker Compose: `v2.39.2-desktop.1`
- MongoDB image: `mongo:7.0.16`
- App: `127.0.0.1:3000`
- Evidence Mongo mapping: `127.0.0.1:27018 -> 27017`

The host already had a native MongoDB listener on `27017`; the override uses `27018` and leaves that process untouched.

## Reproduce

Run from the repository root:

```powershell
$compose = @(
  '-p', 'modern-db-attacks-final',
  '-f', 'docker-compose.yml',
  '-f', 'evidence/final-demo-2026-09-12-revised/docker-compose.port-workaround.yml',
  '-f', 'docker-compose.lab.yml'
)

docker compose @compose up --build -d
docker compose @compose run --rm app node scripts/seed.js --lab

$testsMount = (Join-Path (Get-Location) 'tests') + ':/app/tests:ro'
docker compose @compose run --rm -v $testsMount app npm run test:all

powershell -NoProfile -ExecutionPolicy Bypass -File evidence/final-demo-2026-09-12-revised/run-api-matrix.ps1
```

Open `http://127.0.0.1:3000`, choose `Local lab observation`, and submit each of the six selector options. The six operator screenshots in this folder are the browser proof.

## Evidence index

- `01-docker-build.txt` — Docker build output.
- `02-compose-ps.txt` — running app/MongoDB containers and health.
- `03-seed.txt` — deterministic synthetic-user seed result.
- `04-docker-tests.txt` — the full `npm run test:all` run inside the app container.
- `04-automated-tests.txt` — the matching host-side run.
- `05-api-secure.json` — 28 secure-route cases.
- `06-api-lab.json` — 32 lab-route cases, including all six success payloads, six negative semantic checks, and validation boundaries.
- `07-guards.json` — production-mode and Docker-network locality guard results.
- `12-mongodb-stop.txt`, `12-resilience-down.txt` — stopped-Mongo state and API behavior.
- `13-mongodb-start.txt`, `13-compose-ps-recovered.txt`, `14-resilience-recovered.txt` — MongoDB recovery.
- `14-app-restart.txt`, `14-app-restart-check.txt` — app restart and post-restart login.
- `15-browser-console.txt`, `16-browser-request-details.txt`, `17-browser-payload-bodies.txt` — browser console/network evidence.
- `18-database.json` — counts, password storage checks, and indexes.
- `19-versions.txt` — host/container/runtime versions.
- `20-app-logs.txt` — runtime identity, app logs, and crash-pattern scan.
- `21-npm-audit.txt` — dependency audit output.
- `22-docs-html-check.txt` — all nine Markdown pages have valid HTML siblings.
- `23-final-console.txt` — final browser console snapshot.
- `run-api-matrix.ps1`, `run-production-guard.mjs` — reproducible evidence runners.
- `REPORT.html` — standalone report with the screenshot gallery.

## Browser screenshots

- `01-secure-initial.png` — secure form before submission.
- `02-secure-success.png` — secure scalar login, HTTP 200.
- `03-secure-wrong-password.png` — secure wrong password, HTTP 401.
- `04-lab-operator-catalog.png` — lab mode and revised six-option selector.
- `05-lab-gt-success.png` — `$gt` observation, HTTP 200.
- `06-lab-gte-success.png` — `$gte` observation, HTTP 200.
- `07-lab-ne-success.png` — `$ne` observation, HTTP 200.
- `08-lab-regex-success.png` — `$regex` observation, HTTP 200.
- `09-lab-nin-success.png` — `$nin` observation, HTTP 200.
- `10-lab-exists-success.png` — `$exists` observation, HTTP 200.
- `11-mobile-layout.png` — responsive 375×812 view.
- `12-mongodb-down.png` — UI reports MongoDB unavailable.
- `13-mongodb-recovered.png` — UI ready after MongoDB recovery.
- `14-app-restarted.png` — UI ready after app restart.

## Findings

1. A native MongoDB process occupies host port `27017`; use the included `27018` override on this machine.
2. `npm audit --omit=dev` reports two moderate transitive `qs` advisories through Express `4.22.2`; no dependency upgrade was made during this QA run.
3. The browser can request `/favicon.ico`, which is cosmetic if it returns `404`.
4. When MongoDB is stopped, health returns `503/database: down`; authentication returns a generic `500` until recovery.
5. The Docker image has an empty `Config.User` and therefore runs as the base image user (`root`); this is a production hardening item.

The lab route is a teaching fixture only. Keep it local, use synthetic data, and do not enable it in production.
