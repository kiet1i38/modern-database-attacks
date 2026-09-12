# Project Overview

## 1. Problem statement

A login endpoint often assumes that `username` and `password` arrive as scalar strings. JSON, however, can represent strings, objects, arrays, numbers, booleans and null values.

If an application accepts an object where a string is expected and forwards that object into a MongoDB query, the database may interpret the object as a predicate or operator. The application has unintentionally allowed client input to influence query structure.

This project turns that concept into a small local experiment with an intentionally isolated lab path and a corrected secure path.

## 2. Research questions

1. What is the difference between a SQL query and a MongoDB query document?
2. Which component first crosses the trust boundary when a password object reaches a database query?
3. Why can a syntactically valid query still violate the security intent of a login form?
4. Why is checking a password hash in the application safer than querying the password as a database predicate?
5. Which tests prove that the secure path rejects the same malformed or malicious input?

## 3. Scope

### In scope

- Local browser login form.
- Node.js HTTP server.
- MongoDB running locally or in Docker.
- Seeded synthetic users.
- One isolated lab path showing the unsafe query construction.
- One secure path using strict validation and password hashing.
- Request, query-shape and response evidence.
- Automated regression tests for normal and adversarial input types.

### Out of scope

- Testing any third-party website or production account.
- Internet-facing deployment.
- Real customer data.
- Destructive database operations.
- Building a complete production identity platform.
- Treating one payload as a universal bypass for every MongoDB application.

## 4. Actors and assets

### Actors

- **Student or presenter:** runs the local experiment and explains the result.
- **Normal user:** submits valid login credentials.
- **Untrusted client:** changes JSON types or fields before sending the request.
- **Application:** validates input and constructs database operations.
- **MongoDB:** evaluates the query document.

### Assets

- Synthetic user records.
- Password hashes.
- Authentication result.
- Session or demonstration token, if implemented.
- Server logs and test evidence.

## 5. Success criteria

- A clean machine can start MongoDB and the application using documented commands.
- A seeded synthetic user can log in with the correct password.
- An incorrect password is rejected.
- The isolated lab path visibly demonstrates the query-shape problem under the documented environment.
- The secure path rejects object, array, number and unexpected-field inputs.
- Passwords are not stored in plaintext in the secure collection.
- Tests cover both expected use and malformed input.
- No secret, real credential or public database endpoint is committed.

## 6. Assumptions

- The project uses a Node.js LTS release.
- MongoDB is reachable through a local connection string.
- The team owns the machine and database used for the experiment.
- The official MongoDB driver is used so the query construction is visible.
- The exact behavior of an operator input is recorded with the selected driver, database version and seed data.

## 7. Important terminology

- **Data model:** how information is represented and related.
- **Query document:** a MongoDB object describing fields, values and predicates.
- **Operator:** a database instruction such as a comparison or logical condition.
- **Authentication:** proving an identity.
- **Authorization:** deciding what an authenticated identity may do.
- **Validation:** checking that input has the expected type, shape and allowed values.
- **Injection:** allowing untrusted input to change the meaning or structure of a command or query.