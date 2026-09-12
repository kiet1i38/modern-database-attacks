# Development Workflow

## 1. Prerequisites

- Node.js 20 or newer.
- npm.
- Git.
- Docker Desktop with Compose.
- A local browser.

## 2. First setup

~~~bash
git clone https://github.com/kiet1i38/modern-database-attacks.git
cd modern-database-attacks
npm install
cp .env.example .env
~~~

On Windows PowerShell, use Copy-Item instead of cp.

## 3. Host application with Docker MongoDB

Start MongoDB:

~~~bash
docker compose up -d mongodb
~~~

Seed the secure user and lab user:

~~~bash
npm run seed -- --lab
~~~

Enable the lab route in .env:

~~~dotenv
LAB_MODE=true
~~~

Start the host application:

~~~bash
npm start
~~~

Open http://127.0.0.1:3000.

## 4. All-in-one Docker

Secure-only mode:

~~~bash
docker compose up --build -d
docker compose run --rm app node scripts/seed.js --lab
~~~

Local lab mode:

~~~bash
docker compose down
docker compose -f docker-compose.yml -f docker-compose.lab.yml up --build -d
docker compose -f docker-compose.yml -f docker-compose.lab.yml run --rm app node scripts/seed.js --lab
~~~

The Compose app uses mongodb as the database hostname inside the Docker network. Host-based commands use localhost.

## 5. Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| NODE_ENV | development | Runtime mode. |
| HOST | 127.0.0.1 | Bind address for host execution. |
| PORT | 3000 | HTTP port. |
| MONGODB_URI | mongodb://localhost:27017 | MongoDB connection. |
| MONGODB_DATABASE | modern_database_attacks | Demo database. |
| MONGODB_TEST_DATABASE | modern_database_attacks_test | Integration database. |
| LAB_MODE | false | Enables the guarded lab route. |
| JSON_BODY_LIMIT | 16kb | Request body limit. |
| DEMO_USERNAME | alice | Synthetic username. |
| SECURE_DEMO_PASSWORD | synthetic-demo-password | Synthetic secure password. |
| LAB_DEMO_PASSWORD | lab-only-demo-password | Synthetic lab string password. |

Never put a real secret in .env.example or commit .env.

## 6. Implementation order

1. Runtime and MongoDB health.
2. Seed and indexes.
3. Secure login behavior.
4. Browser form.
5. Guarded local lab observation.
6. Manual evidence and integration test.
7. Optional CI and additional hardening.

## 7. Coding conventions

- Keep database calls in database or service modules.
- Validate at the HTTP boundary.
- Use explicit query shapes.
- Keep lab code visibly isolated.
- Keep response shapes stable.
- Avoid logging sensitive values.
- Add a regression test when changing a security boundary.

## 8. Shutdown and reset

Stop services:

~~~bash
docker compose down
~~~

Reset the named local application database:

~~~bash
ALLOW_LOCAL_RESET=true npm run db:reset
~~~

Remove the Docker volume for a clean MongoDB instance:

~~~bash
docker compose down -v
~~~

Only use reset commands with the project’s local database names.
