# Project Status & Delivery SOP

> The single operating guide for the required MongoDB login demonstration in this repository.

**Document owner:** Project team

**Last updated:** 2026-09-12

**Current focus:** Phase 1 — Runtime and MongoDB bootstrap

**Overall status:** [IN PROGRESS]

## 1. Purpose and source of truth

This file is the project control center. It combines:

- SDLC: the lifecycle used to move from an agreed requirement to a working, verified and documented application.
- SOP: the repeatable steps, outputs and checks used in every phase.
- Status tracking: the exact repository state, next action, blocker and evidence.

The assignment brief is the source of truth for the core scope:

- Category 4 — Web & Authentication
- Topic 12 — Modern Database Attacks
- Required demonstration: create a MongoDB-backed login form and demonstrate authentication bypass with a greater-than-empty style payload such as {"gt": ""}, logging in without the correct password.

The project must remain a controlled local laboratory. It must use synthetic data and must never target a real account, real credential or an externally owned system.

This document intentionally separates required work from recommended security improvements. Recommended improvements are valuable, but they must not obscure or replace the required demonstration.

## 2. How to use this guide

### Before a work session

1. Read the Current snapshot near the bottom.
2. Select one work item from Next recommended work item.
3. Read the SOP for that phase.
4. Inspect the existing repository files before editing.
5. Confirm that the change remains local, synthetic and within the assignment scope.
6. Check for an existing blocker before starting.

### During the work session

1. Work only on the selected slice.
2. Keep source code, API behavior, tests and documentation synchronized.
3. Record assumptions when behavior depends on a driver, database or runtime version.
4. Run the smallest relevant check after each meaningful change.
5. Stop at a failed quality gate and record the blocker.

### At the end of the work session

1. Run the phase-specific verification.
2. Review the diff for secrets, accidental files and scope expansion.
3. Update this file with completed work, evidence and the next action.
4. Update the related document under docs/ when a contract or design changes.
5. Commit one coherent unit of work.

## 3. Status labels

| Label | Meaning | Required action |
| --- | --- | --- |
| [DONE] | Complete and verified. | Link the evidence or command result. |
| [IN PROGRESS] | Started but exit criteria are not complete. | State what remains. |
| [NEXT] | The next recommended action. | Start after entry criteria pass. |
| [TODO] | Planned but not started. | Do not describe it as implemented. |
| [BLOCKED] | Safe progress cannot continue. | Record cause, impact and unblock action. |
| [RECOMMENDED] | Useful extension, not required for the core demonstration. | Track separately from required gates. |
| [REVIEW] | Exists but needs review or verification. | Review code, tests and documentation. |
| [REJECTED] | Intentionally discarded. | Record the reason and replacement. |

A status label describes the current repository state, not an intention.

## 4. Scope classification

### 4.1 Required for the core demonstration

These items are mandatory:

1. A local Node.js web application.
2. A reachable local MongoDB instance.
3. A MongoDB-backed login form served by the application.
4. A repeatable seed for one synthetic user.
5. A normal login with the correct password that succeeds.
6. A normal login with a wrong password that fails.
7. A payload mode that sends a JSON object as the password value, not only a browser password string.
8. A test of the exact assignment-shaped object:

~~~json
{"gt": ""}
~~~

9. A test of the MongoDB operator form when the selected driver and database require it:

~~~json
{"$gt": ""}
~~~

10. A controlled lab result showing the payload that actually works in the selected stack can reach an authenticated success path without the correct password.
11. Evidence of the request, result, environment and synthetic data setup.
12. A README section explaining how a teammate can run the demonstration locally.

### 4.2 Recommended but not a blocker for the core demonstration

These items improve quality and security:

- A separate secure login route.
- Strict schema validation that rejects objects and operator keys.
- Password hashing with bcrypt or Argon2.
- Separate secure and lab collections.
- Automated unit, integration and security regression tests.
- Docker Compose with a pinned MongoDB version.
- Rate limiting, session handling and generic authentication errors.
- CI checks for linting, tests and dependency review.
- A short screen recording in addition to written evidence.

If a recommended item is not implemented, mark it [RECOMMENDED] or [TODO]. Do not claim the core demonstration is incomplete solely because a recommended item is missing.

### 4.3 Explicitly out of scope

Do not add or require these items for this assignment slice:

- Real users or real credentials.
- Public deployment or a publicly reachable database.
- Production authorization, roles or account recovery.
- A complete commercial authentication system.
- Unrelated application features.
- Testing systems that the team does not own.
- Silent changes to the required payload or acceptance criteria.

## 5. Definition of done

The core path is complete only when every required item below is true:

- [ ] The application starts from documented commands.
- [ ] MongoDB connectivity is verified by the application.
- [ ] The login page loads in a browser.
- [ ] A synthetic user can be seeded repeatedly without duplicate setup failures.
- [ ] Correct credentials succeed through the normal path.
- [ ] Wrong credentials fail through the normal path.
- [ ] The browser or an equivalent client can send a nested JSON object as password.
- [ ] The exact object from the brief, {"gt": ""}, has been tested and its result recorded.
- [ ] The MongoDB operator form, {"$gt": ""}, has been tested if required by the selected stack.
- [ ] The working lab payload, if different from the brief spelling, is documented with the reason.
- [ ] The working lab path demonstrates an authenticated result without the correct password.
- [ ] The secure path, if included, rejects the same object and is clearly separated from the lab path.
- [ ] Evidence contains no real secrets or personal data.
- [ ] The README and this file match the actual behavior.

A payload that is merely displayed in the UI is not evidence. The request must be sent, processed and observed.

## 6. Payload compatibility SOP

### 6.1 Why two forms are recorded

The assignment brief shows an object shaped like:

~~~json
{"gt": ""}
~~~

MongoDB query operators conventionally use a dollar-prefixed key. The documented form is:

~~~json
{"$gt": ""}
~~~

The official MongoDB syntax for a greater-than predicate uses a field with a $gt operator: [MongoDB $gt query operator documentation](https://www.mongodb.com/docs/manual/reference/operator/query/gt/).

The project must test the brief-shaped object first, then test the operator-shaped object when needed. Do not silently replace one with the other and report the result as if they were identical.

### 6.2 Required request shape

The payload is nested inside the password field of a JSON request:

~~~json
{
  "username": "alice",
  "password": {
    "$gt": ""
  }
}
~~~

The exact assignment-shaped variant is:

~~~json
{
  "username": "alice",
  "password": {
    "gt": ""
  }
}
~~~

The object must be a JSON object after parsing. This escaped value is not equivalent:

~~~json
{
  "username": "alice",
  "password": "{\"$gt\":\"\"}"
}
~~~

The escaped version is a string. A normal HTML password input also produces a string, so the page needs a clearly labelled payload mode, JSON editor, preset button or equivalent controlled mechanism.

### 6.3 Test and record order

1. Send normal credentials with a string password.
2. Send the exact brief-shaped object.
3. Send the dollar-prefixed operator object if the first object is treated as an ordinary field.
4. Record the HTTP status, response marker, database/driver versions and route used.
5. If a payload works, capture sanitized evidence of the request and response.
6. If neither object works, mark the work item [BLOCKED] instead of weakening the acceptance criterion. Check the request type, query construction, driver version, MongoDB version and seed data before changing code.

## 7. Safety guardrails

These rules apply to every phase:

- Run the lab only on localhost or another explicitly private development network.
- Use a dedicated local database name such as modern_database_attacks_lab.
- Use synthetic usernames and passwords only.
- Keep the lab route disabled unless an explicit LAB_MODE flag is enabled.
- Refuse to run the lab route when NODE_ENV indicates production.
- Never expose MongoDB directly to the Internet.
- Never commit real credentials, tokens, connection strings or personal data.
- Never use a real login form or a third-party service as the target.
- Keep the intentionally unsafe behavior isolated in a lab module.
- Keep a secure route separate from the lab route when it is implemented.
- Do not log password values, session tokens or connection strings.
- Do not add a generic client-controlled filter to the secure route.
- Treat the lab implementation as an educational observation, not a deployable design.
- Do not mark a phase complete when its exit criteria are only planned.

## 8. Target architecture

### 8.1 Minimal technology choice

- Runtime: Node.js with Express.
- Database: local MongoDB using the official Node.js driver.
- Client: plain HTML, CSS and browser JavaScript.
- Configuration: environment variables loaded from a local .env file.
- Testing: Node test runner or the test framework selected in package.json.
- Runtime packaging: Docker Compose is recommended for reproducibility.

Keep the first implementation as a small modular monolith. Avoid adding a frontend framework or unrelated service until the required path works.

### 8.2 Runtime flow

~~~mermaid
flowchart TD
    Browser["Login form"] --> API["Express API"]
    API --> Lab["Lab login route"]
    Lab --> Mongo["Local MongoDB"]
    Mongo --> Lab
    Lab --> API
    API --> Browser
~~~

The lab route is the only route allowed to demonstrate the intentionally unsafe query shape. It must be visibly labelled and locally guarded.

### 8.3 Target folder layout

This is the intended implementation tree. The current repository contains the documentation and placeholder skeleton; application files are still to be implemented.

~~~text
.
├── README.md
├── PROJECT_STATUS.md
├── package.json
├── package-lock.json
├── .env.example
├── .gitignore
├── docker-compose.yml
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
│   ├── app.js
│   ├── server.js
│   ├── config/
│   │   └── env.js
│   ├── db/
│   │   ├── client.js
│   │   ├── collections.js
│   │   └── indexes.js
│   ├── middleware/
│   │   ├── error-handler.js
│   │   └── lab-guard.js
│   ├── modules/
│   │   ├── health/
│   │   │   └── health.routes.js
│   │   └── auth/
│   │       ├── auth.service.js
│   │       ├── lab.routes.js
│   │       ├── secure.routes.js
│   │       └── validation.js
│   ├── public/
│   │   ├── index.html
│   │   ├── app.js
│   │   └── styles.css
│   └── shared/
│       ├── errors.js
│       └── response.js
├── scripts/
│   ├── seed-lab-user.js
│   └── reset-lab-db.js
└── tests/
    ├── unit/
    ├── integration/
    └── security/
~~~

### 8.4 Responsibility boundaries

| Area | Responsibility | Must not do |
| --- | --- | --- |
| config | Validate environment and safe mode flags. | Print secrets. |
| db | Own MongoDB connection and collection access. | Accept arbitrary collections from the client. |
| auth lab | Demonstrate the controlled query-shape behavior. | Run against a production database. |
| auth secure | Validate scalar input and verify passwords safely. | Accept client-created operators. |
| public | Render the login form and show safe results. | Persist passwords or tokens. |
| scripts | Seed and reset synthetic local data. | Reset an unapproved database. |
| tests | Prove expected behavior and boundaries. | Use real accounts or public systems. |

## 9. Data and API contract

### 9.1 Synthetic lab data

Use a dedicated collection such as lab_users and a synthetic document similar to:

~~~json
{
  "username": "alice",
  "password": "lab-only-demo-password",
  "active": true
}
~~~

The password is intentionally simple synthetic test data for a local lab. It is not a production credential and must never be reused.

The seed script must be idempotent:

- Running it once creates the synthetic user.
- Running it again updates or preserves the same test user without uncontrolled duplicates.
- It verifies the active database name before writing.
- It never writes to a production database.

### 9.2 Required endpoints

| Method | Route | Priority | Purpose |
| --- | --- | --- | --- |
| GET | /api/health | Required | Report process and MongoDB readiness. |
| POST | /api/lab/login-observation | Required | Local, guarded lab path for the controlled payload experiment. |
| POST | /api/auth/login | Recommended | Secure comparison path with strict scalar validation. |

The exact route names may be changed only if README, docs/API.md, the browser client and tests are updated together.

The lab response should expose only a safe demonstration result, for example:

~~~json
{
  "authenticated": true,
  "mode": "lab",
  "reason": "controlled local observation"
}
~~~

Do not return the user document, password, password hash, query internals or database connection details.

The secure route should reject object, array, null and numeric password values before database authentication. It should return a generic failure response for invalid credentials.

### 9.3 UI modes

The page must make the request type understandable:

| UI mode | Input type | Purpose |
| --- | --- | --- |
| Normal login | Username and password strings | Prove correct and wrong password behavior. |
| Payload test | Username plus structured JSON password | Send the two object variants without turning them into escaped strings. |
| Secure comparison | Normal scalar credentials | Show that strict validation rejects the object. |

The payload mode must display a local-lab warning and must not be available when the lab guard is disabled.

## 10. Lifecycle map

The core delivery path is G0 through G4. G5 and G6 are recommended extensions.

| Phase | Name | Priority | Gate | Status |
| --- | --- | --- | --- | --- |
| 0 | Requirement alignment and architecture | Required | G0 | [DONE] |
| 1 | Runtime and MongoDB bootstrap | Required | G1 | [NEXT] |
| 2 | Seed data, login API and form | Required | G2 | [TODO] |
| 3 | Guarded payload observation | Required | G3 | [TODO] |
| 4 | Verification, evidence and handoff | Required | G4 | [TODO] |
| 5 | Secure remediation path | Recommended | G5 | [RECOMMENDED] [TODO] |
| 6 | Extended tests, CI and cleanup | Recommended | G6 | [RECOMMENDED] [TODO] |

A phase cannot pass its gate until the required outputs and checks are complete.

## 11. Quality gates

### Gate G0 — Requirement and architecture

Pass when:

- The assignment requirement is written in this file.
- Required, recommended and out-of-scope work are separated.
- The two payload spellings and test order are documented.
- The local-only and synthetic-data boundary is documented.
- The target tree and route contract are defined.
- The next implementation slice is small enough to verify.

Status: [DONE] after this document update.

### Gate G1 — Runtime and MongoDB

Pass when a clean checkout can:

- Install dependencies using the lockfile.
- Start the pinned local MongoDB service.
- Load configuration from .env.
- Connect to MongoDB.
- Return a healthy result from GET /api/health.
- Shut down without hanging processes.
- Refuse unsafe production configuration for lab mode.

### Gate G2 — Seed, login API and form

Pass when:

- The synthetic lab user can be seeded repeatably.
- The browser login page loads.
- Correct string credentials succeed.
- Wrong string credentials fail.
- Unknown users fail without leaking internals.
- Normal and payload input modes are visibly distinct.
- The payload mode sends an object value, not a quoted JSON string.
- The request and response contract is documented.

### Gate G3 — Payload observation

Pass when:

- LAB_MODE is explicitly enabled.
- The lab route refuses production mode.
- The exact brief-shaped object has been sent.
- The dollar-prefixed operator object has been sent when required.
- The result of each variant is recorded.
- A working variant demonstrates the required authentication bypass in the local lab.
- The response contains no password, hash or query internals.
- The secure route, if present, rejects the same object.

If no variant produces the required controlled result, the gate is [BLOCKED]. Do not mark it [DONE] based only on source code inspection.

### Gate G4 — Evidence and handoff

Pass when:

- The normal success and failure cases are captured.
- The working payload request and response are captured.
- The exact payload variant is written down.
- Node.js, MongoDB and driver versions are recorded.
- The setup works from the README.
- The evidence is sanitized.
- PROJECT_STATUS.md and docs match the implementation.
- A teammate can repeat the demonstration locally.

### Gate G5 — Secure remediation

Recommended gate. Pass when:

- The secure route rejects nested objects and operator keys.
- Password verification uses a password hash.
- The repository owns the filter shape.
- Invalid credentials are generic.
- Security regression tests prove the payload does not bypass the secure route.

This gate improves the project but is not required to show the isolated lab behavior.

### Gate G6 — Extended quality

Recommended gate. Pass when:

- Unit and integration tests are automated.
- Browser smoke verification is automated or repeatable.
- CI runs the required checks.
- Dependency and secret checks are present.
- Temporary lab artifacts are excluded from commits.
- The handoff instructions are complete.

## 12. Phase SOPs

## Phase 0 — Requirement alignment and architecture

**Objective:** convert the brief into testable requirements and a small implementation plan.

### Procedure

1. Read the assignment brief.
2. Write the required demonstration in plain language.
3. Separate required and recommended work.
4. Define normal login behavior.
5. Define wrong-password behavior.
6. Define the exact object variant and the MongoDB operator variant.
7. Define the object-versus-string UI requirement.
8. Define the local lab boundary.
9. Confirm the target folder layout.
10. Confirm route names and response fields.
11. Update README and docs when the implementation contract changes.

### Required outputs

- This status document.
- Architecture and database documentation.
- API contract.
- Security boundary.
- Testing matrix.
- Empty application skeleton.

### Exit criteria

- Another teammate can explain the required path without hidden chat context.
- The first implementation slice is runtime and health only.
- No major requirement is represented only by a vague note.

## Phase 1 — Runtime and MongoDB bootstrap

**Objective:** prove the process and database can start reliably.

### Procedure

1. Add package.json.
2. Add and commit the lockfile.
3. Add .gitignore and .env.example.
4. Add a pinned local MongoDB service.
5. Add environment validation.
6. Add MongoDB connection management.
7. Add graceful startup and shutdown.
8. Add GET /api/health.
9. Add a minimal runtime test.
10. Run setup from a clean checkout.
11. Update this file with G1 evidence.

### Required outputs

- package.json and lockfile.
- .env.example.
- .gitignore.
- docker-compose.yml or equivalent local setup.
- Configuration module.
- Database client module.
- Health route.
- Startup instructions.

### Exit criteria

- A new machine can run the documented setup.
- Health reports process and database readiness.
- Invalid configuration fails clearly.
- Shutdown closes the MongoDB client.
- No secret is printed or committed.

## Phase 2 — Seed data, login API and form

**Objective:** create the normal login baseline before testing the object payload.

### Procedure

1. Define the lab database and collection constants.
2. Implement an idempotent synthetic-user seed.
3. Add the normal login route.
4. Add the login service and explicit query construction.
5. Add the browser page.
6. Add normal string input mode.
7. Add payload JSON input mode.
8. Make the lab warning visible.
9. Test correct password, wrong password and unknown user.
10. Update API and demo documentation.
11. Update this file with G2 evidence.

### Exit criteria

- Correct string credentials succeed.
- Wrong string credentials fail.
- Unknown users fail safely.
- The page can send a nested object.
- The page does not persist password values.
- Seed can be repeated against the dedicated lab database.

## Phase 3 — Guarded payload observation

**Objective:** demonstrate the query-shape behavior in a local, isolated route.

### Procedure

1. Add the LAB_MODE guard.
2. Refuse the lab route in production mode.
3. Confirm the test database name.
4. Send the exact brief-shaped object.
5. Send the dollar-prefixed operator object if required.
6. Record request body shape, route, status and result.
7. Record Node.js, driver and MongoDB versions.
8. Capture sanitized browser or network evidence.
9. Keep the secure route separate.
10. Update docs with the observed behavior, including any version dependency.
11. Update this file with G3 evidence.

### Exit criteria

- The working variant produces the required local authentication bypass.
- The bypass does not require a real account or real credential.
- The browser and API both show which mode is active.
- The evidence can be repeated.
- The behavior is not exposed as a public service.

## Phase 4 — Verification, evidence and handoff

**Objective:** make the result reproducible and easy to assess.

### Procedure

1. Run the complete required test matrix.
2. Repeat the setup from a clean checkout.
3. Capture a screenshot of the normal login form.
4. Capture normal success and wrong-password failure.
5. Capture the payload request and successful lab response.
6. Record the exact payload spelling that worked.
7. Record versions and commands.
8. Review logs for secrets.
9. Update README, docs and this file.
10. Commit the coherent implementation and documentation.
11. Write the next recommended work item.

### Exit criteria

- All required acceptance criteria are checked.
- Evidence has no real secrets or personal data.
- The repository tells a teammate exactly how to reproduce the result.
- Any environment-specific limitation is documented.

## Phase 5 — Secure remediation path

**Priority:** Recommended.

### Procedure

1. Add a separate secure route.
2. Validate that username and password are scalar strings.
3. Reject nested objects, arrays, null and operator keys.
4. Use password hashes.
5. Keep the database filter application-controlled.
6. Return generic invalid-credential responses.
7. Add a regression test using both payload variants.
8. Label the secure route as the comparison path.

### Exit criteria

- The same payload cannot bypass the secure route.
- The lab route remains isolated and explicitly labelled.
- Documentation explains the contrast between the two paths.

## Phase 6 — Extended tests, CI and cleanup

**Priority:** Recommended.

### Procedure

1. Add unit tests for validation and response mapping.
2. Add integration tests against a disposable MongoDB database.
3. Add a browser smoke test.
4. Add lint, format and dependency checks.
5. Add CI only after local commands are stable.
6. Remove temporary logs and local artifacts.
7. Verify .gitignore.
8. Review the tree and README.

### Exit criteria

- Local and CI commands agree.
- Tests are repeatable.
- No generated secret or database volume is committed.
- The project remains small and focused.

## 13. Required test matrix

| Case | Request password value | Expected purpose | Result to record |
| --- | --- | --- | --- |
| Health | Not applicable | Prove process and database readiness. | Status and database state. |
| Correct normal login | String | Prove baseline success. | Success response and screenshot. |
| Wrong normal login | String | Prove ordinary failure. | Failure status and message. |
| Unknown user | String | Prove user lookup failure. | Generic failure. |
| Brief-shaped object | {"gt": ""} | Test the exact brief spelling. | Whether it is treated as an operator or ordinary field. |
| Operator object | {"$gt": ""} | Test MongoDB operator form. | Whether controlled bypass occurs. |
| Escaped operator | "{\"$gt\":\"\"}" | Prove object-versus-string distinction. | Type and authentication result. |
| Missing password | Missing field | Prove request handling. | Validation status. |
| Array or number | Non-scalar value | Recommended boundary check. | Rejection or lab observation. |
| Secure route object | Object | Recommended remediation check. | Must reject without bypass. |

The expected result of the two object cases is an observation to record, not an assumption. The core evidence must show which payload and environment produced the working result.

## 14. Evidence checklist

### Required evidence

- [ ] Screenshot or recording of the login form.
- [ ] Normal correct-password request and success.
- [ ] Normal wrong-password request and failure.
- [ ] Exact brief-shaped payload request.
- [ ] Operator-shaped payload request when required.
- [ ] Successful local lab response without the correct password.
- [ ] Seed command and synthetic user identifier.
- [ ] Node.js, MongoDB and driver versions.
- [ ] Startup and shutdown commands.
- [ ] README reproduction steps.
- [ ] Link to the relevant commit.

### Evidence safety rules

- Hide or replace all real secrets.
- Do not publish a MongoDB connection string containing credentials.
- Do not show real user documents.
- Do not show password hashes from a real account.
- Do not include session tokens.
- Prefer a sanitized network payload and safe response marker.
- Keep screenshots and recordings local unless the team explicitly approves sharing.

## 15. Blocker and decision procedures

### 15.1 Payload mismatch blocker

Use this procedure if the object shown in the brief does not produce the same result as the operator form:

1. Confirm the request has Content-Type application/json.
2. Confirm password is parsed as an object, not a string.
3. Confirm the route under test is the guarded lab route.
4. Confirm the database and collection contain the synthetic user.
5. Confirm the exact brief-shaped object was tested first.
6. Test the dollar-prefixed operator form.
7. Record MongoDB, driver and Node.js versions.
8. Record both results in the test matrix.
9. If a working variant exists, document the difference explicitly.
10. If no working variant exists, mark G3 [BLOCKED] and investigate before changing the acceptance criterion.

### 15.2 General design decision

When a new design choice appears:

1. State the problem.
2. List the smallest number of viable options.
3. Compare safety, complexity, reproducibility and teaching value.
4. Choose one option.
5. Record the reason and consequence.
6. Update affected documents.

Decision format:

~~~markdown
### Decision: <short title>

**Date:** YYYY-MM-DD

**Decision:** <chosen option>

**Reason:** <why>

**Trade-off:** <what becomes easier or harder>

**Documents to update:** <paths>
~~~

### 15.3 Blocker format

~~~markdown
### Blocker

**Status:** [BLOCKED]

**Detected in:** Phase <number>, Gate <name>

**Cause:** <exact cause>

**Impact:** <what cannot continue>

**Unblock action:** <specific action>

**Owner:** <person>
~~~

Do not hide a blocker by weakening the payload test, removing the evidence requirement or silently changing the database target.

## 16. Git and review procedure

Use focused commits. Do not mix runtime setup, payload behavior and unrelated refactoring in one commit.

Recommended sequence:

1. Create a branch for the current phase or work item.
2. Make the smallest coherent change.
3. Run the relevant checks.
4. Review the diff for secrets and scope expansion.
5. Update status and documentation.
6. Commit with an action-based message.
7. Check the commit against the phase gate.

Suggested branch names:

- phase-1/runtime-bootstrap
- phase-2/login-form
- phase-3/payload-observation
- phase-4/evidence
- phase-5/secure-remediation
- phase-6/quality

Suggested commit messages:

- build: add local runtime
- feat: add synthetic lab seed
- feat: add login form
- test: record payload behavior
- docs: update demonstration evidence
- fix: isolate lab route

## 17. Work item and session templates

### Work item template

~~~markdown
## Work item: <action>

**Phase:** Phase <number>

**Priority:** Required or Recommended

**Owner:** <person>

**Status:** [TODO]

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

- <test output, screenshot or commit>

### Blockers

- None

### Handoff

**Completed:** <what changed>

**Next:** <next action>
~~~

### Session update template

~~~markdown
### Session update — YYYY-MM-DD

**Phase:** Phase <number>

**Status:** [IN PROGRESS]

**Completed:**

- <completed item>

**Verified with:**

- <command>

**Known issues:**

- None

**Next action:**

1. <one concrete next step>
~~~

## 18. Current snapshot

### Completed

- [DONE] Repository is accessible.
- [DONE] The required MongoDB login demonstration is written as testable acceptance criteria.
- [DONE] Required, recommended and out-of-scope work are separated.
- [DONE] The object-versus-string payload issue is documented.
- [DONE] Both payload spellings and their test order are documented.
- [DONE] Local-only and synthetic-data guardrails are documented.
- [DONE] Target architecture and folder layout are documented.
- [DONE] Database and API contracts are documented.
- [DONE] Testing and evidence requirements are documented.
- [DONE] Application folder skeleton exists.
- [DONE] SDLC and SOP operating procedure is documented.

### Not started

- [TODO] Node.js package setup and lockfile.
- [TODO] Environment configuration.
- [TODO] Local MongoDB service.
- [TODO] MongoDB client and health endpoint.
- [TODO] Synthetic lab-user seed.
- [TODO] Login API.
- [TODO] Login form and payload mode.
- [TODO] Guarded lab behavior.
- [TODO] Required evidence capture.
- [RECOMMENDED] Secure comparison route.
- [RECOMMENDED] Automated security regression tests.
- [RECOMMENDED] CI workflow.

### Current blocker

- None recorded.
- G3 must not be marked complete until a real local request demonstrates the working payload result.

## 19. Next recommended work item

[NEXT] Phase 1 — Runtime and MongoDB bootstrap.

Work on one focused slice:

1. Add package.json and the lockfile.
2. Add .gitignore and .env.example.
3. Add a pinned local MongoDB setup.
4. Add configuration validation.
5. Add the MongoDB client.
6. Add GET /api/health.
7. Add one runtime test.
8. Run the setup from a clean checkout.
9. Record the G1 command and result here.

Do not begin payload behavior until G1 passes. Do not treat source code that merely constructs a query as proof of the required demonstration.

## 20. Change log

| Date | Change |
| --- | --- |
| 2026-09-12 | Added architecture documentation and the application skeleton. |
| 2026-09-12 | Added the project progress flag. |
| 2026-09-12 | Expanded the progress flag into an SDLC execution guide with phase SOPs and quality gates. |
| 2026-09-12 | Re-scoped the control document around the MongoDB login demonstration, explicit acceptance criteria, payload compatibility, evidence and required-versus-recommended work. |
