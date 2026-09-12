# Local Demonstration Guide

## 1. Purpose

This guide explains how to present the project as a controlled experiment. The presenter should show the request, the application decision, the database interaction and the corrected behavior.

Run only on localhost or a private machine owned by the team.

## 2. Preparation

Before presenting:

1. Start Docker and MongoDB.
2. Run the seed script.
3. Start the Node.js server.
4. Check the health endpoint.
5. Open the browser client.
6. Verify that the secure route works.
7. Enable lab mode only if the local observation is needed.
8. Keep a recorded run and terminal commands as backup.

## 3. Recommended explanation order

### Part A: data models

Explain that SQL commonly uses tables and SQL statements, while MongoDB uses collections, documents and query documents. Emphasize that both still have query semantics and parsers.

### Part B: request lifecycle

Show the path:

```text
Browser JSON -> JSON parser -> application object -> validation -> repository -> MongoDB
```

Explain that validation is the security boundary. The database should receive a query shape designed by the application.

### Part C: normal authentication

1. Submit the synthetic correct password.
2. Show the successful response.
3. Explain that the secure path finds the user by username and verifies the hash in application code.

### Part D: incorrect authentication

1. Submit a wrong password string.
2. Show the generic failure response.
3. Explain that the response does not reveal whether the username exists.

### Part E: isolated lab observation

If lab mode is enabled, show that a password object is a different JSON type from a password string. Explain that an unsafe query can treat the object as a predicate.

Do not claim that the input works against every MongoDB application. Show the exact environment and the observed result.

### Part F: corrected behavior

1. Send the same object-type input to the secure route.
2. Show the validation error.
3. Explain that the secure route does not query by password.
4. Show the test or log proving the database query was not executed for invalid input.

## 4. Evidence to capture

- Browser request and response.
- Server-side request ID.
- Sanitized input type.
- Fixed secure query shape.
- Database document without exposing a password hash.
- Test output.
- MongoDB and driver versions.
- Runtime mode and local host.

Never capture real passwords, tokens, connection strings or personal data.

## 5. Questions and short answers

### Why does a parser not automatically stop injection?

A parser checks whether input is valid for the language. It does not know whether the client is authorized to request that meaning.

### Where is the actual design mistake?

At the application boundary, when a client-controlled value is allowed to become part of a query structure.

### Why not query by password hash?

The application should retrieve the user by username and use a password-hash verification function. This keeps the password input out of the database predicate.

### Is a login bypass the same as full database access?

No. The impact depends on database privileges, session handling and authorization checks on later routes.

### Does removing a dollar sign solve the problem?

Not reliably. A blacklist is incomplete. The stronger defense is strict type validation, explicit query construction and rejecting unexpected structures.

## 6. Recovery plan

If the live run fails:

- Use the recorded video.
- Show the test output.
- Show the documented request lifecycle.
- Explain which environmental dependency failed.
- Do not improvise against an external target.

## 7. Cleanup

After the session:

- Stop the local containers.
- Remove temporary test data if required.
- Disable lab mode.
- Check that no secrets or logs were committed.
- Keep only synthetic evidence in the repository.