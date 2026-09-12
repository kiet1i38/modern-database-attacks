# Project Status & Delivery SOP

> The single operating guide for planning, implementing, testing and documenting this repository.

**Document owner:** Project team

**Last updated:** 2026-09-12

**Current lifecycle phase:** Phase 0 — Discovery, architecture and documentation

**Current overall status:** `[IN PROGRESS]`

## 1. Purpose of this document

This file combines two complementary things:

- **SDLC (Software Development Life Cycle):** the complete lifecycle used to move from an agreed idea to a tested and documented application.
- **SOP (Standard Operating Procedure):** the exact repeatable steps, outputs and checks used inside every lifecycle phase.

Use this file as the project control center. Before starting work, read the current phase and the next recommended work item. After every work session, update the status, evidence, blockers and next action.

This guide is intentionally detailed so that another teammate can continue the project without relying on undocumented memory.

## 2. How to use the guide

### Before starting a work session

1. Read the **Current snapshot** near the bottom of this file.
2. Select one work item from **Next recommended work item**.
3. Read that phase SOP and confirm its entry criteria.
4. Inspect the existing files before making changes.
5. Check that the change does not violate the project guardrails.

### During the work session

1. Work only on the selected scope.
2. Keep source, configuration, tests and documentation consistent.
3. Record assumptions when a decision is not obvious.
4. Run the smallest relevant test after each meaningful change.
5. Stop and record a blocker instead of silently bypassing a quality gate.

### At the end of the work session

1. Run the phase-specific verification commands.
2. Review changed files for secrets, accidental scope expansion and unclear names.
3. Update this file with completed work, evidence and the next action.
4. Update the related document under `docs/` if behavior or contracts changed.
5. Commit one coherent unit of work.

## 3. Status system

| Label | Meaning | Required action |
| --- | --- | --- |
| `[DONE]` | Work is complete and verified. | Link evidence or test output. |
| `[IN PROGRESS]` | Work has started but the exit criteria are not met. | State the remaining work. |
| `[NEXT]` | The recommended next action. | Start only after entry criteria pass. |
| `[TODO]` | Planned but not started. | Do not describe it as implemented. |
| `[BLOCKED]` | Progress cannot continue safely. | Record cause, owner and unblock action. |
| `[REVIEW]` | Implementation exists and needs review. | Check code, tests and documentation. |
| `[REJECTED]` | The approach was intentionally discarded. | Record the decision and replacement. |

A status label must describe the current repository state, not an intention.

## 4. Project guardrails

These rules apply to every phase:

- Use a small modular monolith unless a documented decision changes that choice.
- Keep the secure runtime behavior as the default.
- Keep lab-only behavior isolated, synthetic and local.
- Never test against a system, account, API or database that the team does not own.
- Never commit real credentials, tokens, connection strings or personal data.
- Never pass the complete client request body directly into a database query.
- Do not expose MongoDB or a lab route to the public Internet.
- Keep implementation, tests and documentation synchronized.
- Prefer a small verified change over a large unverified change.
- Do not mark a phase complete when its exit criteria are only planned.

## 5. Lifecycle map

| Phase | Name | Primary outcome | Gate | Status |
| --- | --- | --- | --- | --- |
| 0 | Discovery and architecture | Agreed scope, architecture and documentation | G0 | `[IN PROGRESS]` |
| 1 | Runtime bootstrap | Node process, configuration, MongoDB and health check | G1 | `[TODO]` |
| 2 | Data foundation | Collections, indexes and repeatable seed data | G2 | `[TODO]` |
| 3 | Secure authentication | Validated login service and secure API | G3 | `[TODO]` |
| 4 | Local lab isolation | Clearly separated local observation path | G4 | `[TODO]` |
| 5 | Browser client | Small user interface connected to the API | G5 | `[TODO]` |
| 6 | Verification and evidence | Automated tests, manual checks and recorded evidence | G6 | `[TODO]` |
| 7 | Handoff and maintenance | Synchronized docs, clean repository and continuation plan | G7 | `[TODO]` |

A phase may contain many commits, but it cannot pass its gate until all required outputs and checks are complete.

## 6. Quality gates

### Gate G0 — Scope and architecture

Pass when:

- Project scope and non-goals are written.
- The planned source tree is accepted.
- API and database contracts are written.
- Secure and lab responsibilities are separated.
- Environment variable names are fixed.
- No unresolved decision would force a major rewrite.

### Gate G1 — Runtime

Pass when a clean checkout can:

- Install dependencies using the lockfile.
- Start the pinned local MongoDB service.
- Load configuration from `.env`.
- Connect to MongoDB.
- Return a healthy response from `GET /api/health`.
- Shut down without hanging processes.

### Gate G2 — Data foundation

Pass when:

- Secure and lab collections are explicitly separated.
- Required indexes are created.
- Seed execution is idempotent.
- Secure data stores only password hashes.
- Test data uses a separate database name.
- Reset operations are protected by an environment check.

### Gate G3 — Secure authentication

Pass when:

- The request schema requires scalar strings.
- Unknown fields and nested objects are rejected.
- The repository finds users by an application-controlled username filter.
- Password verification happens in application code.
- Invalid credentials return a generic response.
- Passwords and hashes are absent from responses and logs.

### Gate G4 — Lab isolation

Pass when:

- Lab mode is opt-in.
- Lab mode refuses to run in production.
- Lab data is synthetic.
- The lab route is visibly labeled.
- The secure route does not depend on lab data.
- The local-only restriction is tested.

### Gate G5 — Browser client

Pass when:

- The browser can submit valid credentials.
- Success and failure states are understandable.
- Invalid input is shown without leaking internals.
- Lab mode is clearly distinguished from secure mode.
- The browser does not persist passwords.
- The UI works from the documented start command.

### Gate G6 — Verification and evidence

Pass when:

- Unit tests pass.
- Integration tests pass against a disposable database.
- Security regression tests pass.
- Manual browser checks pass.
- Database and dependency versions are recorded.
- Evidence contains no secrets or personal data.
- The same setup works from a clean checkout.

### Gate G7 — Handoff

Pass when:

- README commands match the actual project.
- `PROJECT_STATUS.md` reflects the real state.
- All changed behavior has related documentation.
- No generated secrets, logs or local volumes are committed.
- A teammate can identify the next task without asking for hidden context.

## 7. Universal SOP for every work item

Use this procedure for every feature, fix, test or documentation change.

### Step 1 — Define the work item

Write one sentence using an action verb:

- Add MongoDB health check.
- Create idempotent seed script.
- Add strict login schema.
- Add security regression tests.
- Synchronize API documentation.

A work item should have one owner, one intended outcome and a clear completion check.

### Step 2 — Check entry criteria

Before editing, confirm:

- The parent phase is active.
- Required dependencies exist.
- The target files are known.
- No blocker is already recorded.
- The change is allowed by the project guardrails.

### Step 3 — Inspect before editing

Review:

- Existing file tree.
- Related documentation.
- Current environment configuration.
- Existing tests.
- Recent changes and unresolved decisions.

Do not design against a file that has not been inspected.

### Step 4 — Implement the smallest coherent change

- Keep the change within the selected scope.
- Reuse existing module boundaries.
- Avoid unrelated refactors.
- Keep secure and lab behavior visibly separate.
- Add or update tests with the behavior.

### Step 5 — Verify locally

Run the smallest relevant checks first, then the phase gate checks. Record the command and result.

### Step 6 — Review the diff

Check for:

- Secrets and personal data.
- Accidental files.
- Untracked generated files.
- Inconsistent names.
- Missing error handling.
- Documentation that no longer matches behavior.

### Step 7 — Update project control documents

Update:

- This file if status, phase, blocker or next action changed.
- The relevant `docs/*.md` file if a contract or design changed.
- The README if setup commands changed.

### Step 8 — Commit the work

Use one focused commit message. Examples:

- `build: add local runtime`
- `feat: add secure authentication`
- `test: add object-type regression cases`
- `docs: synchronize database contract`

### Step 9 — Record the handoff

Write what is complete, what was verified, what remains and what the next person should do first.

## 8. Phase SOPs

## Phase 0 — Discovery and architecture

**Objective:** create a stable design before application logic is written.

### Entry criteria

- Repository is accessible.
- Project topic and local-only boundary are understood.
- No source implementation is required for this phase.

### Procedure

1. Read `README.md`.
2. Read `docs/PROJECT_OVERVIEW.md`.
3. Read `docs/ARCHITECTURE.md`.
4. Read `docs/DATABASE.md`.
5. Read `docs/API.md`.
6. Read `docs/SECURITY.md`.
7. Read `docs/TESTING.md`.
8. Confirm the modular monolith structure.
9. Confirm the `users` and `lab_users` separation.
10. Confirm the environment variable names.
11. Record unresolved decisions in this file.

### Required outputs

- Architecture documentation.
- Database contract.
- API contract.
- Security model.
- Testing strategy.
- Application skeleton.
- Updated progress status.

### Exit criteria

- No major implementation decision is hidden in chat or memory.
- The first implementation slice is limited to runtime and health checking.
- The team agrees not to add unrelated features.

## Phase 1 — Runtime bootstrap

**Objective:** prove that the application process and local database can start reliably.

### Procedure

1. Add `package.json`.
2. Add and commit the lockfile.
3. Add `.gitignore`.
4. Add `.env.example`.
5. Add configuration loading with safe defaults.
6. Add Docker Compose with a pinned MongoDB image.
7. Add MongoDB connection management.
8. Add graceful startup and shutdown.
9. Add `GET /api/health`.
10. Add a small runtime test.
11. Run the setup from a clean checkout.

### Required outputs

- `package.json` and lockfile.
- `.env.example`.
- `.gitignore`.
- `docker-compose.yml`.
- Configuration module.
- Database client module.
- Health route.
- Startup instructions.

### Exit criteria

- A new machine can run the documented setup.
- Health reports HTTP and database state.
- Invalid configuration fails with a clear message.
- Shutdown closes the MongoDB client.
- No secret is printed or committed.

## Phase 2 — Data foundation

**Objective:** create deterministic synthetic data and explicit database boundaries.

### Procedure

1. Define collection constants.
2. Implement index creation.
3. Implement secure user schema.
4. Implement optional lab user schema.
5. Implement idempotent seed script.
6. Generate password hashes inside the seed process.
7. Add a separate test database.
8. Add a guarded reset script.
9. Add integration tests for indexes and seed repeatability.
10. Update `docs/DATABASE.md` if behavior differs from the plan.

### Exit criteria

- Running seed twice does not duplicate users.
- Secure collection contains hashes, not plaintext passwords.
- Lab data is synthetic and separate.
- Indexes exist after setup.
- Reset cannot target an unexpected database.

## Phase 3 — Secure authentication

**Objective:** implement the secure path as the default behavior.

### Procedure

1. Define a strict login schema.
2. Reject unknown request keys.
3. Reject objects, arrays, null and numbers in scalar fields.
4. Normalize the username consistently.
5. Implement `findUserByUsername`.
6. Implement password-hash verification.
7. Add generic invalid-credential errors.
8. Add inactive-user handling.
9. Add rate limiting suitable for the local app.
10. Add unit and integration tests.
11. Inspect responses and logs for secret leakage.

### Exit criteria

- Valid credentials work.
- Invalid credentials fail.
- Non-string password input is rejected before database authentication.
- The repository does not accept a client-generated filter.
- Password hashes never leave the service boundary.
- Tests cover all required input types.

## Phase 4 — Isolated local lab path

**Objective:** make the unsafe query-shape behavior observable without weakening the secure path.

### Procedure

1. Add an explicit `LAB_MODE` guard.
2. Require a local host.
3. Require a non-production environment.
4. Use the separate `lab_users` collection.
5. Add visible lab-only labels.
6. Keep the route out of the default secure route.
7. Add tests for enabled and disabled modes.
8. Record driver, database and seed versions.
9. Document that observed behavior is implementation-dependent.
10. Check that no real credentials are used.

### Exit criteria

- Lab mode is opt-in.
- The lab route is unavailable in production.
- Secure authentication does not depend on lab mode.
- The evidence is reproducible locally.
- The documentation does not overstate the result.

## Phase 5 — Browser client

**Objective:** provide a minimal user interface that makes the request and response behavior understandable.

### Procedure

1. Create the static page.
2. Add username and password fields.
3. Add loading and error states.
4. Add secure-mode labels.
5. Add a clearly separated local lab control only when enabled.
6. Send JSON to the documented endpoint.
7. Clear password fields after submission.
8. Do not store credentials in local storage.
9. Test keyboard and browser error behavior.
10. Add a browser smoke check.

### Exit criteria

- The UI works from the documented command.
- Success and failure are understandable.
- The UI does not expose internal errors.
- Password values are not persisted.
- Lab and secure paths cannot be confused.

## Phase 6 — Verification and evidence

**Objective:** prove that the application and its security boundary work from a clean setup.

### Procedure

1. Run lint and formatting checks.
2. Run unit tests.
3. Start a disposable database.
4. Run seed and integration tests.
5. Run security regression tests.
6. Run the browser smoke check.
7. Stop the services and repeat from a clean checkout.
8. Record versions and commands.
9. Review logs for secrets.
10. Capture sanitized evidence.
11. Compare implementation against every document.

### Exit criteria

- All required tests pass.
- Clean-checkout setup succeeds.
- Database failure is handled.
- Unexpected input is rejected.
- Evidence contains no secrets.
- Documentation matches actual behavior.

## Phase 7 — Handoff and maintenance

**Objective:** leave the repository understandable and safe for the next work session.

### Procedure

1. Update README commands.
2. Update the relevant architecture and API sections.
3. Update this status file.
4. Remove temporary logs and local artifacts.
5. Check `.gitignore`.
6. Review the complete tree.
7. Record known limitations.
8. Record the next work item.
9. Commit documentation synchronization.

### Exit criteria

- Another teammate can start the project from the README.
- The current phase and next action are unambiguous.
- No hidden manual setup is required.
- Known risks and limitations are written down.

## 9. Work item template

Copy this template into an issue or work note before starting a substantial task:

```markdown
## Work item: <action>

**Phase:** Phase <number>

**Owner:** <person>

**Status:** `[TODO]`

### Objective

<One measurable outcome>

### Entry criteria

- [ ] Required dependency exists.
- [ ] Target files are identified.
- [ ] Related documentation has been read.

### Planned changes

- <file or module>
- <file or module>

### Verification

- [ ] <command>
- [ ] <manual check>

### Evidence

- <test output, commit or screenshot>

### Blockers

- None

### Handoff

**Completed:** <what changed>

**Next:** <next action>
```

## 10. Blocker procedure

When work cannot proceed:

1. Stop at the failed quality gate.
2. Mark the work item `[BLOCKED]`.
3. Write the exact error or missing decision.
4. Identify whether the blocker is code, environment, access, design or dependency related.
5. Propose one unblock action.
6. Do not hide the blocker by changing the acceptance criteria.
7. Resume only after the blocker is resolved and recorded.

Blocker format:

```markdown
### Blocker

**Status:** `[BLOCKED]`

**Detected in:** Phase <number>, Gate <name>

**Cause:** <exact cause>

**Impact:** <what cannot continue>

**Unblock action:** <specific action>

**Owner:** <person>
```

## 11. Decision procedure

When a new design choice appears:

1. State the problem.
2. List the smallest number of viable options.
3. Compare security, complexity, testability and teaching value.
4. Choose one option.
5. Record the reason and consequence.
6. Update affected documents.

Do not silently change the database model, API contract or runtime mode.

Decision format:

```markdown
### Decision: <short title>

**Date:** YYYY-MM-DD

**Decision:** <chosen option>

**Reason:** <why>

**Trade-off:** <what becomes easier or harder>

**Documents to update:** <paths>
```

## 12. Testing and evidence rules

Every completed implementation item must have at least one form of evidence:

- Automated test output.
- Manual command output.
- Browser screenshot.
- Reproducible setup transcript.
- Code review result.

Evidence must be sanitized. Do not include:

- Real passwords.
- Password hashes from a real account.
- Connection strings with credentials.
- Session tokens.
- Personal data.
- Public URLs to a local database.

## 13. Git and review procedure

Use focused commits and avoid mixing documentation, runtime setup and authentication behavior in one commit.

Recommended sequence:

1. Create a branch for the phase or work item.
2. Make the smallest coherent change.
3. Run the relevant checks.
4. Review the diff.
5. Update status and documentation.
6. Commit with an action-based message.
7. Review the commit against the phase exit criteria.

Suggested branch names:

- `phase-1/runtime-bootstrap`
- `phase-2/data-foundation`
- `phase-3/secure-authentication`
- `phase-4/lab-isolation`
- `phase-5/browser-client`
- `phase-6/verification`

## 14. Session update format

At the end of every session, update the relevant section using this format:

```markdown
### Session update — YYYY-MM-DD

**Phase:** Phase <number>

**Status:** `[IN PROGRESS]`

**Completed:**

- <completed item>

**Verified with:**

- `<command>`

**Known issues:**

- None

**Next action:**

1. <one concrete next step>
```

## 15. Current snapshot

### Completed

- `[DONE]` Repository is accessible.
- `[DONE]` Project scope and non-goals are documented.
- `[DONE]` Application architecture is documented.
- `[DONE]` Database design is documented.
- `[DONE]` API contracts are documented.
- `[DONE]` Security model is documented.
- `[DONE]` Testing strategy is documented.
- `[DONE]` Development workflow is documented.
- `[DONE]` Local demonstration guide is documented.
- `[DONE]` Application folder skeleton exists.
- `[DONE]` SDLC and SOP operating procedure is documented.

### In progress

- `[IN PROGRESS]` Review the architecture and agree on the first implementation slice.

### Not started

- `[TODO]` Node.js package setup.
- `[TODO]` Environment configuration.
- `[TODO]` Docker Compose.
- `[TODO]` MongoDB client.
- `[TODO]` Health endpoint.
- `[TODO]` Collections and seed script.
- `[TODO]` Secure authentication.
- `[TODO]` Lab isolation.
- `[TODO]` Browser client.
- `[TODO]` Automated tests.
- `[TODO]` CI workflow.

## 16. Next recommended work item

**`[NEXT]` Phase 1 — Runtime bootstrap**

Start with one focused slice:

1. Add `package.json`.
2. Add `.gitignore`.
3. Add `.env.example`.
4. Add Docker Compose.
5. Add the MongoDB client.
6. Add `GET /api/health`.
7. Add one runtime test.
8. Run the setup from a clean checkout.
9. Update this file with Gate G1 evidence.

Do not start authentication, browser polish or lab behavior before Gate G1 passes.

## 17. Change log

| Date | Change |
| --- | --- |
| 2026-09-12 | Added architecture documentation and initial source skeleton. |
| 2026-09-12 | Added the project progress flag. |
| 2026-09-12 | Expanded the progress flag into an SDLC execution guide with phase SOPs, quality gates and handoff procedures. |