# HTTP API Contract

## 1. Conventions

- Base path: /api.
- Request and response format: application/json.
- Authentication failures use generic messages.
- Validation failures do not include database details.
- Passwords, password hashes and query internals are never returned.

## 2. Health endpoint

### GET /api/health

Purpose: verify that the process is alive and report MongoDB connectivity.

Success:

~~~json
{
  "ok": true,
  "service": "modern-database-attacks",
  "database": "up"
}
~~~

Database unavailable:

~~~json
{
  "ok": false,
  "service": "modern-database-attacks",
  "database": "down"
}
~~~

The unavailable response uses HTTP 503.

## 3. Secure login

### POST /api/auth/login

Request:

~~~json
{
  "username": "alice",
  "password": "synthetic-demo-password"
}
~~~

Success:

~~~json
{
  "ok": true,
  "user": {
    "username": "alice",
    "role": "student"
  }
}
~~~

Invalid credentials:

~~~json
{
  "ok": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid credentials"
  }
}
~~~

Invalid input:

~~~json
{
  "ok": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Invalid request"
  }
}
~~~

The secure route accepts only a string username and string password. It rejects objects, arrays, numbers, booleans, null values and unknown body fields before user lookup.

## 4. Lab status

### GET /api/lab/status

This endpoint is safe to call from the browser and reports the mode without returning database details.

Lab disabled:

~~~json
{
  "ok": true,
  "enabled": false,
  "mode": "secure-only"
}
~~~

Lab enabled:

~~~json
{
  "ok": true,
  "enabled": true,
  "mode": "lab"
}
~~~

## 5. Lab observation route

### POST /api/lab/login-observation

This route is available only when LAB_MODE=true, NODE_ENV is not production and the request is local.

Normal string request:

~~~json
{
  "username": "alice",
  "password": "lab-only-demo-password"
}
~~~

Brief-shaped object request:

~~~json
{
  "username": "alice",
  "password": {
    "gt": ""
  }
}
~~~

Operator-shaped object request:

~~~json
{
  "username": "alice",
  "password": {
    "$gt": ""
  }
}
~~~

Successful controlled observation:

~~~json
{
  "ok": true,
  "authenticated": true,
  "mode": "lab",
  "inputType": "object",
  "payloadVariant": "$gt",
  "user": {
    "username": "alice",
    "role": "student"
  },
  "note": "Controlled local lab result; do not reuse this route in production"
}
~~~

Failed lab observation returns HTTP 401 with the same mode and input metadata, but never returns a password or query object.

## 6. Logout

### POST /api/auth/logout

The current application does not create a persistent session. The endpoint exists as a safe placeholder:

~~~json
{
  "ok": true
}
~~~

## 7. Status code policy

| Status | Meaning |
| --- | --- |
| 200 | Request completed successfully. |
| 400 | Body type, shape or field validation failed. |
| 401 | Credentials are invalid. |
| 403 | The lab request is not from loopback. |
| 404 | Route is disabled or does not exist. |
| 503 | MongoDB is unavailable. |
| 500 | Unexpected server error; details stay in server logs. |

## 8. Implementation rules

- Routes call services; services own authentication decisions.
- The secure route queries by username and verifies a stored hash in application code.
- The lab route is intentionally isolated and explicitly labelled.
- The browser sends JSON with Content-Type application/json.
- The browser never stores the password after submission.
