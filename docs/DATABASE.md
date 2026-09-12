# Database Design

## 1. Database names

Default application database:

~~~text
modern_database_attacks
~~~

Integration tests use:

~~~text
modern_database_attacks_test
~~~

The test database is separate so integration cleanup cannot affect normal demo data.

## 2. Collections

### users

The secure collection stores password hashes only:

~~~json
{
  "_id": "ObjectId",
  "username": "alice",
  "passwordHash": "scrypt$...",
  "role": "student",
  "active": true,
  "createdAt": "ISODate",
  "updatedAt": "ISODate"
}
~~~

The secure route finds a user by username and active status, then verifies the submitted string against passwordHash in application code.

### lab_users

The local laboratory collection uses synthetic plaintext data so the query-shape observation is easy to explain:

~~~json
{
  "_id": "ObjectId",
  "username": "alice",
  "password": "lab-only-demo-password",
  "role": "student",
  "active": true
}
~~~

This collection must never contain a real password and must never be used by the secure route.

## 3. Indexes

The application creates unique username indexes for both collections:

~~~javascript
database.collection("users").createIndex(
  { username: 1 },
  { unique: true, name: "users_username_unique" }
);

database.collection("lab_users").createIndex(
  { username: 1 },
  { unique: true, name: "lab_users_username_unique" }
);
~~~

## 4. Seed command

Seed secure data:

~~~bash
npm run seed
~~~

Seed both secure and lab data:

~~~bash
npm run seed -- --lab
~~~

The seed is idempotent. It upserts the synthetic user and does not print password values.

The lab seed is permitted only when NODE_ENV is not production.

## 5. Query boundaries

Secure query shape:

~~~javascript
database.collection("users").findOne({
  username,
  active: true
});
~~~

The secure route never accepts a complete filter from the browser.

Lab query shape:

~~~javascript
database.collection("lab_users").findOne({
  username,
  password
});
~~~

The lab query is intentionally unsafe and exists only behind the local guard. It must not be copied into a real authentication service.

## 6. Reset command

The reset script is deliberately guarded:

~~~bash
ALLOW_LOCAL_RESET=true npm run db:reset
~~~

It refuses production mode, requires the explicit flag and checks that the database name belongs to the project namespace.

## 7. Data lifecycle

- Demo data is disposable.
- Lab data is synthetic.
- Real user data is out of scope.
- Docker volumes are local artifacts.
- Do not commit .env or database dumps.
