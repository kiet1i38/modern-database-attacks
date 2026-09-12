# Application Architecture

## 1. Architectural style

The application is a small modular monolith. It runs as one Node.js process while keeping configuration, database access, authentication and the browser client in separate modules.

The two authentication paths are intentionally separate:

- Secure path: strict scalar validation, username lookup and password-hash verification.
- Lab path: local-only, opt-in observation of an unsafe query shape using synthetic data.

## 2. Runtime topology

~~~mermaid
flowchart TD
  Browser["Browser login form"] --> Express["Express application"]
  Express --> Secure["Secure route"]
  Express --> Lab["Guarded lab route"]
  Secure --> Users["users collection"]
  Lab --> LabUsers["lab_users collection"]
~~~

MongoDB is never exposed directly to the browser.

## 3. Source tree

~~~text
src/
├── app.js
├── server.js
├── config/
│   └── env.js
├── db/
│   ├── client.js
│   ├── collections.js
│   └── indexes.js
├── middleware/
│   └── lab-guard.js
├── modules/
│   ├── health/
│   │   └── health.routes.js
│   └── auth/
│       ├── auth.service.js
│       ├── lab.routes.js
│       ├── password.js
│       ├── secure.routes.js
│       └── validation.js
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
└── shared/
    └── errors.js
~~~

Supporting scripts are under scripts/ and tests are under tests/.

## 4. Module responsibilities

### app.js

- Creates the Express application.
- Registers JSON parsing with a small body limit.
- Serves the static browser client.
- Mounts health, secure and lab routes.
- Registers safe 404 and error responses.

### server.js

- Loads configuration.
- Connects to MongoDB.
- Creates indexes.
- Starts the HTTP server.
- Closes the HTTP server and database client on shutdown.

### config/env.js

- Parses environment variables.
- Validates ports and database names.
- Provides safe local defaults.
- Exposes LAB_MODE as an explicit feature flag.

### db/client.js

- Owns the MongoDB client lifecycle.
- Exposes connect, db, ping and close operations.
- Uses a short server-selection timeout so startup failures are visible.

### auth.service.js

- Secure path: fixed username lookup and hash verification.
- Lab path: isolated query-shape observation.
- Returns only public user fields to routes.

### validation.js

- Requires a plain JSON body.
- Requires exactly username and password keys.
- Normalizes the username.
- Requires a string password in secure mode.
- Allows a small structured password value only in lab mode.

### lab-guard.js

- Requires LAB_MODE=true.
- Refuses production mode.
- Accepts loopback host or loopback socket requests only.

## 5. Secure flow

~~~mermaid
sequenceDiagram
  participant B as Browser
  participant R as Secure route
  participant V as Validator
  participant S as Auth service
  participant M as MongoDB
  B->>R: JSON strings
  R->>V: Validate scalar fields
  V-->>R: Typed credentials
  R->>S: Authenticate
  S->>M: Find by username and active
  M-->>S: User with password hash
  S-->>R: Verify hash
  R-->>B: Generic success or failure
~~~

The password is not part of the secure MongoDB predicate.

## 6. Lab flow

The lab route receives a local JSON request and intentionally constructs a query using the password value. With a string, this behaves like ordinary equality. With an object, MongoDB may interpret the nested value as a predicate. The result must be recorded with the exact driver and database versions.

The lab route is educational only. It is not a session system, authorization layer or production design.

## 7. Runtime modes

- Secure-only: default when LAB_MODE=false.
- Local lab: enabled only when LAB_MODE=true and NODE_ENV is not production.
- Test: use a separate database name for integration tests.

## 8. Docker boundary

Docker Compose runs:

- One MongoDB 7.0.16 container.
- One Node.js 20 application container.
- A named local MongoDB volume.
- Loopback-only host port bindings for 27017 and 3000.

The lab override file changes only the application LAB_MODE value.
