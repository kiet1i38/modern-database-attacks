# CampusDesk · Modern Database Attacks

Four real local websites in one repo: **MySQL safe/unsafe + MongoDB safe/unsafe**, with admin/user dashboards, tickets, persistent sessions and authentication-injection demonstrations.

## Run

Start Docker Desktop, then:

~~~sh
git clone https://github.com/kiet1i38/modern-database-attacks.git
cd modern-database-attacks
docker compose up -d --build --wait --wait-timeout 240
~~~

No host database or .env file is required.

| Website | URL |
| --- | --- |
| SQL Unsafe | http://localhost:3001 |
| SQL Safe | http://localhost:3002 |
| Mongo Unsafe | http://localhost:3003 |
| Mongo Safe | http://localhost:3004 |

Synthetic accounts: **admin / Admin@123**, **student / Student@123**, **student2 / Student2@123**. Startup seeds three accounts and twelve tickets only when the variant database is empty.

## Demo

Use normal login first, then select **Demo injection** on the login page. Four SQL presets and six Mongo operators are available on both safe and unsafe versions. Unsafe attempts execute against a real database and create a real admin session when successful; safe counterparts reject them. Mongo operators require the dollar prefix, e.g. {"$gt":""}.

Admin: global dashboard, ticket processing, account creation/lock, authentication audit. User: own dashboard/tickets and profile. Backend checks role and ownership on every protected request; account locking invalidates access from existing sessions.

## Test and evidence

Host tests need Node.js >=22.12:

~~~sh
npm ci
npm test
npm run test:integration
npm run build
npm audit --omit=dev
~~~

Integration tests use the four running Docker sites and write a timestamped evidence folder. They create synthetic QA data. Browser reproduction on Windows: **scripts/run-browser-evidence.ps1**.

- [Run, access, reset and troubleshoot](docs/RUN_AND_TEST.html)
- [Final demonstration script](docs/DEMO_GUIDE.html)
- [Architecture](docs/ARCHITECTURE.html)
- [API and session/CSRF contract](docs/API.html)
- [Testing and limitations](docs/TESTING.html)
- [New evidence report](evidence/campusdesk-final-2026-10-09/REPORT.html)
- [Documentation hub](docs/index.html) — also served at http://localhost:3004/docs/

HTML documents can be opened in a browser. Documentation v1 is archived in docs/legacy/; previous source/tests remain for comparison but are not the CampusDesk entrypoint.

## Reset / stop

The following commands delete **only the selected variant's synthetic lab data**, including accounts, tickets, audit and sessions, then reseed:

~~~sh
docker compose exec -T sql-unsafe npm run db:reset
docker compose exec -T sql-safe npm run db:reset
docker compose exec -T mongo-unsafe npm run db:reset
docker compose exec -T mongo-safe npm run db:reset
docker compose down
~~~

Stopping with down preserves database volumes. Do not add -v unless you deliberately want to delete them.

## Local teaching boundary

Unsafe authentication is intentional. All credentials/secrets in Compose are public synthetic lab values. Applications bind to host loopback; databases have no host-published ports. Startup rejects production mode and requires LAB_LOCAL_ONLY=true. Never expose this lab publicly, use real credentials, or point it at production data. Safe here means hardened against the demonstrated login-injection paths, not a comprehensive production-security certification.
