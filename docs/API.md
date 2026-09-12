# HTTP API Contract

## 1. Conventions

- Base path: `/api`.
- Request and response format: `application/json`.
- All responses include an `ok` boolean.
- Authentication failures use a generic message.
- Validation failures do not include database details.
- A request ID is included in logs and responses when available.

## 2. Health endpoint

### `GET /api/health`

Purpose: verify that the HTTP process is alive and report database connectivity without leaking credentials.

Success:

```json
{
  "ok": true,
  "service": "modern-database-attacks",
  "database": "up"
}
```

Database unavailable:

```json
{
  "ok": false,
  "service": "modern-database-attacks",
  "database": "down"
}
```

## 3. Secure login

### `POST /api/auth/login`

Request:

```json
{
  "username": "alice",
  "password": "synthetic-demo-password"
}
```

Success:

```json
{
  "ok": true,
  "user": {
    "username": "alice",
    "role": "student"
  }
}
```

Invalid credentials:

```json
{
  "ok": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid credentials"
  }
}
```

Invalid input type:

```json
{
  "ok": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Invalid request"
  }
}
```

The secure route must reject a password object, array, number, boolean, null value or unknown body field before any user query is executed.

## 4. Lab observation route

### `POST /api/lab/login-observation`

This route is optional and must be enabled only in explicit local lab mode. Its purpose is to make the unsafe query construction visible using synthetic data.

The route must:

- Be disabled when `NODE_ENV=production`.
- Be disabled for non-local hosts.
- Use the separate `lab_users` collection.
- Display a clear lab-only label.
- Never accept real credentials.
- Never be copied into a production authentication flow.

The request and response contract should be documented in the running application and test fixtures, but the route must not be treated as a secure login endpoint.

## 5. Logout

### `POST /api/auth/logout`

If sessions are implemented, this endpoint invalidates the current synthetic session. A stateless demonstration may return a successful response after clearing the browser-side state.

```json
{
  "ok": true
}
```

## 6. Optional identity endpoint

### `GET /api/auth/me`

Returns the authenticated synthetic identity without password fields or internal database details.

```json
{
  "ok": true,
  "user": {
    "username": "alice",
    "role": "student"
  }
}
```

## 7. Status code policy

| Status | Meaning |
| --- | --- |
| `200` | Request completed successfully. |
| `400` | Body type, shape or field validation failed. |
| `401` | Credentials are invalid or session is missing. |
| `404` | Route does not exist. |
| `429` | Rate limit exceeded. |
| `503` | Database or required service is unavailable. |
| `500` | Unexpected server error; details stay in server logs. |

## 8. API implementation rules

- Routes call services; routes do not write MongoDB filters directly.
- Services call repositories; repositories accept typed application values.
- Error messages are stable and generic.
- Request bodies have a small size limit.
- Unknown fields are rejected on authentication requests.
- Sensitive fields are removed from every response.