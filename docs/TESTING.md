# Testing Strategy

## 1. Test commands

Install dependencies:

~~~bash
npm install
~~~

Run unit and security-boundary tests:

~~~bash
npm test
~~~

Run the real MongoDB integration test:

~~~bash
npm run test:integration
~~~

Run all tests:

~~~bash
npm run test:all
~~~

## 2. Test layers

### Unit tests

Located in tests/unit/:

- Scalar credential validation.
- Structured lab payload validation.
- Unknown-field rejection.
- Password hashing and verification.
- Malformed hash failure behavior.

### Security-boundary tests

Located in tests/security/:

- Secure route rejects an object password before user lookup.
- Secure route accepts the correct synthetic scalar password.
- Lab route can expose the object-shaped behavior in an isolated test double.
- Lab route returns 404 when LAB_MODE is disabled.

These tests do not require MongoDB.

### Real MongoDB integration test

Located in tests/integration/mongodb.test.js.

The test connects to MONGODB_TEST_DATABASE and inserts only a synthetic temporary document. It verifies:

- String equality finds the document.
- The brief-shaped object does not match the string field.
- The dollar-prefixed greater-than object matches the non-empty string field.
- Temporary test data is removed in a finally block.

Start MongoDB before running this test.

## 3. Required manual matrix

| Case | Route | Input | Expected observation |
| --- | --- | --- | --- |
| Health | GET /api/health | None | Database reports up. |
| Correct secure login | POST /api/auth/login | Two strings | HTTP 200. |
| Wrong secure password | POST /api/auth/login | Wrong string | HTTP 401. |
| Unknown secure user | POST /api/auth/login | Unknown string username | HTTP 401. |
| Brief object | POST /api/lab/login-observation | password: {"gt": ""} | Record actual result. |
| Operator object | POST /api/lab/login-observation | password: {"$gt": ""} | Record actual result. |
| Escaped object text | Lab or secure route | password: "{\"$gt\":\"\"}" | Treated as a string. |
| Secure object | POST /api/auth/login | password object | HTTP 400, no user lookup. |
| Lab disabled | Lab route | Any valid JSON | HTTP 404. |

## 4. Evidence checklist

- [ ] Docker or local MongoDB version recorded.
- [ ] Node.js and mongodb driver versions recorded.
- [ ] Seed command recorded.
- [ ] Health response captured.
- [ ] Correct and wrong string results captured.
- [ ] Both object variants captured.
- [ ] Working lab response captured if available.
- [ ] Secure object rejection captured.
- [ ] No real secret, hash, token or personal data is visible.
- [ ] README and PROJECT_STATUS.md match the run.

## 5. Failure diagnosis

### MongoDB connection failure

Check:

- Docker container status.
- Port 27017 availability.
- MONGODB_URI.
- MONGODB_DATABASE.
- Application logs without publishing credentials.

### Lab route returns 404

Check:

- LAB_MODE=true.
- NODE_ENV is not production.
- The running process was restarted after changing .env.
- The request is sent to localhost or 127.0.0.1.

### Object is sent as a string

Check the browser result panel or network tab. The request must contain:

~~~json
{
  "password": {
    "$gt": ""
  }
}
~~~

It must not contain an escaped JSON string.

## 6. Evidence safety

Do not store real credentials, production data, password hashes from real users, session tokens or public database connection strings.
