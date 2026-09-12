# Development Workflow

## 1. Prerequisites

- Node.js LTS.
- npm.
- Docker and Docker Compose.
- Git.
- A local browser.

## 2. Environment variables

Create `.env` from `.env.example`:

```dotenv
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017
MONGODB_DATABASE=modern_database_attacks
MONGODB_TEST_DATABASE=modern_database_attacks_test
LAB_MODE=false
SESSION_SECRET=replace-with-local-only-secret
```

Rules:

- `.env` must be ignored by Git.
- `.env.example` contains placeholders only.
- `LAB_MODE` defaults to `false`.
- The lab route must refuse to run in production mode.

## 3. Local commands

The eventual `package.json` should provide commands similar to:

```bash
npm install
npm run db:up
npm run db:seed
npm run dev
npm test
npm run test:security
npm run lint
```

The exact commands should be kept synchronized with the README after implementation.

## 4. Docker Compose responsibilities

Docker Compose should:

- Start one local MongoDB container.
- Persist data only in a named local volume.
- Avoid publishing MongoDB to all network interfaces when possible.
- Use a health check.
- Use a pinned image version tested by the team.
- Avoid committing production credentials.

The application may run on the host during development or in its own container after the host workflow is stable.

## 5. Implementation phases

### Phase 1: repository and runtime

- Add `package.json` and lockfile.
- Add environment loader.
- Add Docker Compose.
- Add MongoDB connection and health endpoint.

### Phase 2: data and seed

- Add collections and indexes.
- Add idempotent seed script.
- Add synthetic secure user.
- Add optional synthetic lab user.

### Phase 3: secure authentication

- Add strict schemas.
- Add user repository.
- Add authentication service.
- Add secure login route.
- Add safe error handling.

### Phase 4: isolated lab observation

- Add explicit local-mode guard.
- Add a separate lab collection and route.
- Add visible lab-only labels.
- Add tests that prove the route is disabled outside local mode.

### Phase 5: browser client

- Add a small login page.
- Show normal and invalid responses.
- Show lab mode clearly when enabled.
- Do not display or store passwords after submission.

### Phase 6: verification

- Add unit, integration and security tests.
- Run the project from a clean checkout.
- Record versions and evidence.
- Review the docs against the implemented behavior.

## 6. Coding conventions

- Use one responsibility per module.
- Prefer explicit names over generic helper functions.
- Keep database calls in repositories.
- Keep authentication decisions in services.
- Validate at the HTTP boundary.
- Return stable error codes.
- Avoid logging sensitive values.
- Add a test when a security behavior is fixed.

## 7. Git workflow

Use small commits grouped by concern:

- `docs: define architecture`
- `build: add local runtime`
- `feat: add secure authentication`
- `test: add security regression cases`
- `docs: synchronize implementation guide`

Each implementation phase should be runnable or clearly marked as incomplete.

## 8. Definition of done

A phase is complete when:

- The code and documentation agree.
- The relevant tests pass.
- A clean machine can reproduce the behavior.
- No secret is committed.
- The security boundary is visible in code and tests.
- The change has a focused commit message.