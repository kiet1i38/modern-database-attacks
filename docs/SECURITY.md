# Security Model

## 1. Objective

The application demonstrates the security boundary between client-controlled JSON and a MongoDB query. It also provides a separate secure path showing strict validation and application-level password verification.

The lab is local and educational. It must not be used against an external system.

## 2. Trust boundary

~~~mermaid
flowchart LR
  Client["Untrusted browser JSON"] --> Boundary["Express validation boundary"]
  Boundary --> Secure["Secure authentication service"]
  Boundary --> Lab["Guarded local lab service"]
  Secure --> SecureDB["users"]
  Lab --> LabDB["lab_users"]
~~~

The secure service owns the query shape. The lab service is the only place where the unsafe observation is intentionally retained.

## 3. Vulnerable mechanism under observation

The lab service uses an explicit isolated query:

~~~javascript
database.collection("lab_users").findOne({
  username,
  password
});
~~~

A password string behaves as an equality value. A password object can be interpreted as a nested query predicate by MongoDB. The exact result must be measured in the selected environment.

This behavior is intentionally unavailable in production mode and is bound to loopback requests.

## 4. Secure mechanism

The secure service:

1. Validates that username and password are strings.
2. Rejects unknown body fields.
3. Finds the active user by username only.
4. Verifies the submitted password against a stored scrypt hash.
5. Returns only public identity fields.
6. Uses a generic invalid-credentials response.

## 5. Required controls

- LAB_MODE defaults to false.
- The lab route refuses NODE_ENV=production.
- The lab route accepts loopback requests only.
- The application binds to loopback by default on the host.
- Docker publishes ports to 127.0.0.1 only.
- The secure collection stores password hashes, not plaintext passwords.
- The browser clears its password field after submission.
- Passwords, hashes, tokens and query internals are not returned.
- Database names are validated before use.
- Reset requires an explicit local flag.

## 6. What this project does not claim

Do not claim that:

- One object works against every MongoDB application.
- A login result grants database access.
- Password hashing alone fixes unsafe query construction.
- A local observation proves a production system is vulnerable.
- Removing one character from a key is a complete defense.

The correct conclusion is narrower: allowing a client-controlled object where a scalar password was expected can change query meaning in an unsafe implementation. Strict types and application-owned query construction prevent that class of mistake in the secure path.

## 7. Safe testing policy

- Use only the synthetic user created by scripts/seed.js.
- Use only localhost or a private machine owned by the team.
- Do not connect to third-party sites, accounts or databases.
- Do not expose MongoDB to the Internet.
- Stop the lab after collecting evidence.
- Set LAB_MODE=false after the demonstration.

## 8. Limitations

The current application does not implement a persistent login session or full authorization model. The authenticated response is a demonstration marker, not a production session.
