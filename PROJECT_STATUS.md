# Project Status

> Progress flag for the repository architecture and implementation work.

**Last updated:** 2026-09-12

## Current phase

**Phase 0 — Architecture, documentation and application skeleton**

The repository currently contains the project documentation and an empty source layout. No application logic has been implemented yet.

## Status legend

- `[DONE]` Completed and reviewed.
- `[IN PROGRESS]` Started but not complete.
- `[NEXT]` Recommended next action.
- `[TODO]` Planned work not started.
- `[BLOCKED]` Cannot proceed until a dependency or decision is resolved.

## Completed

- `[DONE]` Repository created and accessible.
- `[DONE]` Project scope and learning objectives documented.
- `[DONE]` Application architecture documented.
- `[DONE]` Planned source tree documented.
- `[DONE]` Database collections, indexes and seed strategy documented.
- `[DONE]` HTTP API contracts documented.
- `[DONE]` Security model and trust boundaries documented.
- `[DONE]` Testing strategy and security regression cases documented.
- `[DONE]` Development workflow and local runtime plan documented.
- `[DONE]` Local demonstration guide documented.
- `[DONE]` Empty application folder skeleton created.

## Current state

- `[IN PROGRESS]` Documentation and structure review.
- `[TODO]` Node.js package setup.
- `[TODO]` Environment configuration.
- `[TODO]` Docker Compose for local MongoDB.
- `[TODO]` MongoDB connection and health endpoint.
- `[TODO]` Database indexes and idempotent seed script.
- `[TODO]` Secure authentication service.
- `[TODO]` Strict request validation.
- `[TODO]` Isolated local lab route.
- `[TODO]` Browser client.
- `[TODO]` Unit, integration and security tests.
- `[TODO]` CI workflow.

## Recommended next step

1. Add `package.json` and lockfile.
2. Add `.env.example` and `.gitignore`.
3. Add `docker-compose.yml` with a pinned MongoDB image and health check.
4. Implement only the MongoDB client and `GET /api/health`.
5. Run the health check from a clean checkout.

This is the safest first implementation slice because it verifies the runtime and database connection before authentication logic is introduced.

## Planned phases

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Architecture, documentation and skeleton | In progress |
| 1 | Runtime, configuration and database health | Todo |
| 2 | Collections, indexes and seed data | Todo |
| 3 | Secure authentication path | Todo |
| 4 | Isolated local lab path | Todo |
| 5 | Browser client and user-visible flow | Todo |
| 6 | Automated tests, evidence and CI | Todo |

## Current planned tree

```text
modern-database-attacks/
├── README.md
├── PROJECT_STATUS.md
├── docs/
├── src/
│   ├── config/
│   ├── db/
│   ├── middleware/
│   ├── modules/
│   │   ├── auth/
│   │   └── health/
│   ├── shared/
│   └── public/
├── scripts/
└── tests/
    ├── unit/
    ├── integration/
    └── security/
```

## Important decisions

- Use a modular monolith rather than multiple services.
- Use the official MongoDB driver so query construction stays visible.
- Keep the secure path as the default runtime behavior.
- Keep lab-only behavior isolated and local.
- Use synthetic users and never commit real credentials.
- Do not expose MongoDB or the lab route to the public Internet.
- Do not write application logic until the API and database documents are reviewed.

## Definition of ready to code

The project is ready for the first implementation slice when:

- The team agrees with the planned source tree.
- The team agrees with the `users` and `lab_users` separation.
- The secure API contract is accepted.
- Local MongoDB startup is reproducible.
- The environment variable names are fixed.
- The first implementation is limited to runtime setup and health checking.

## Change log

| Date | Change |
| --- | --- |
| 2026-09-12 | Added architecture documentation and initial source skeleton. |
| 2026-09-12 | Added this progress flag. |