# Topic 12 – Modern Database Attacks

> Documentation-only architecture for a controlled local security lab about MongoDB-backed authentication and NoSQL operator injection.

## Project purpose

This repository will contain a small, reproducible web application that explains how untrusted JSON input can change a MongoDB query when the application does not enforce the expected data type.

The project has two intentionally separated behaviors:

- A lab-only vulnerable path used to observe the problem.
- A secure path used to demonstrate the corrected design.

The project must run only on localhost or a private lab machine. It must never be used to test systems, accounts, APIs or databases that the team does not own.

## Main learning outcomes

- Understand the difference between SQL and NoSQL data models.
- Trace JSON parsing, application validation, driver serialization and MongoDB query execution.
- Explain where query semantics can be changed by untrusted input.
- Distinguish authentication from authorization.
- Compare a vulnerable login flow with a secure password-verification flow.
- Reproduce the same test cases before and after the security fix.

## Proposed stack

- Node.js with Express.
- MongoDB using the official Node.js driver.
- Zod or an equivalent strict request-schema validator.
- bcrypt or Argon2 for password verification.
- Plain HTML, CSS and JavaScript for the small browser client.
- Docker Compose for a reproducible local MongoDB instance.

## Documentation map

- [`docs/PROJECT_OVERVIEW.md`](docs/PROJECT_OVERVIEW.md): goals, scope, assumptions and acceptance criteria.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): components, layers, source tree and request flows.
- [`docs/DATABASE.md`](docs/DATABASE.md): collections, schemas, indexes, seed data and query rules.
- [`docs/API.md`](docs/API.md): endpoints, request and response contracts, errors and status codes.
- [`docs/SECURITY.md`](docs/SECURITY.md): threat model, trust boundaries and defenses.
- [`docs/TESTING.md`](docs/TESTING.md): unit, integration, security and manual test strategy.
- [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md): setup, environment variables, implementation phases and workflow.
- [`docs/DEMO_GUIDE.md`](docs/DEMO_GUIDE.md): local demonstration script, evidence and explanation order.

## Planned repository tree

```text
modern-database-attacks/
├── README.md
├── package.json
├── package-lock.json
├── .env.example
├── .gitignore
├── docker-compose.yml
├── Dockerfile
├── docs/
│   ├── PROJECT_OVERVIEW.md
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── API.md
│   ├── SECURITY.md
│   ├── TESTING.md
│   ├── DEVELOPMENT.md
│   └── DEMO_GUIDE.md
├── src/
│   ├── server.js
│   ├── app.js
│   ├── config/
│   ├── db/
│   ├── middleware/
│   ├── modules/
│   │   ├── auth/
│   │   └── health/
│   ├── shared/
│   └── public/
├── scripts/
│   ├── seed.js
│   └── reset-db.js
└── tests/
    ├── unit/
    ├── integration/
    └── security/
```

## Current repository state

The repository starts as an empty documentation and architecture project. Source code should be added only after the documents are reviewed and the data/API contracts are agreed.

## Non-negotiable principles

- Keep the vulnerable behavior isolated, labeled and disabled outside the lab mode.
- Never use real credentials or real user data.
- Never expose MongoDB to the public Internet.
- Never pass the entire request body directly into a database query.
- Make the secure path the default path.
- Keep the README and test evidence reproducible on a clean machine.