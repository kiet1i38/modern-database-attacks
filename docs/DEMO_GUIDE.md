# Local Demonstration Guide

## 1. Purpose

Show a repeatable local experiment:

1. A normal MongoDB-backed login form.
2. Correct and incorrect scalar credential behavior.
3. A structured payload sent as an object.
4. The observed result in the isolated lab route.
5. The secure route rejecting the same object.

Use only the synthetic local account.

## 2. Preparation

Host workflow:

~~~bash
npm install
docker compose up -d mongodb
npm run seed -- --lab
~~~

Set LAB_MODE=true in .env and start:

~~~bash
npm start
~~~

Docker workflow:

~~~bash
docker compose -f docker-compose.yml -f docker-compose.lab.yml up --build -d
docker compose -f docker-compose.yml -f docker-compose.lab.yml run --rm app node scripts/seed.js --lab
~~~

Check:

~~~bash
curl http://127.0.0.1:3000/api/health
~~~

## 3. Demonstration order

### Step A: normal secure login

Select Secure comparison.

Use:

- Username: alice
- Password: synthetic-demo-password

Show HTTP 200 and the public username/role only.

### Step B: wrong password

Keep the username and enter a wrong string. Show HTTP 401 and the generic invalid-credentials response.

### Step C: exact brief-shaped object

Select Local lab observation and choose the assignment-shaped object. The browser sends:

~~~json
{
  "username": "alice",
  "password": {
    "gt": ""
  }
}
~~~

Record the status and response. This spelling must not be silently replaced.

### Step D: MongoDB operator object

Choose the operator variant. The browser sends:

~~~json
{
  "username": "alice",
  "password": {
    "$gt": ""
  }
}
~~~

Record the status, input type, payload variant and authenticated marker. The result is valid evidence only for the documented local environment.

### Step E: secure comparison

Send an object password to POST /api/auth/login. The secure route should return HTTP 400 before database authentication because the field is not a string.

## 4. What to explain

- JSON has multiple value types; a password field is not automatically a string.
- The application is responsible for validating the type and owning the query shape.
- The lab route intentionally shows the unsafe construction with synthetic data.
- The secure route finds by username and verifies a hash in application code.
- A local result does not prove universal behavior or production exposure.

## 5. Evidence to capture

- Browser form and mode label.
- Health response.
- Correct credential success.
- Wrong credential failure.
- Exact brief-shaped request.
- Operator-shaped request.
- Successful lab response if produced.
- Secure-route object rejection.
- Node.js, MongoDB and driver versions.
- Relevant commit and README commands.

Do not capture real credentials, tokens, connection strings or personal data.

## 6. Recovery plan

If a live run fails:

- Use the saved curl output or screen recording.
- Show the integration test output.
- Check Docker status and the configured database URI.
- Confirm that the payload is an object, not escaped text.
- Confirm LAB_MODE and local host.
- Explain the environment limitation instead of testing an external target.

## 7. Cleanup

~~~bash
docker compose down
~~~

Then:

- Set LAB_MODE=false.
- Remove temporary evidence containing credentials.
- Check git status.
- Confirm .env is ignored.
- Do not commit database volumes or logs.
