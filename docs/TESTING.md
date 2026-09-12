# Testing Strategy

## 1. Testing goals

Tests must demonstrate both functional correctness and the security boundary:

- Valid credentials work.
- Invalid credentials fail.
- Unexpected JSON types are rejected.
- The secure route does not construct a query from a client-controlled object.
- Database failures return controlled responses.
- The lab behavior is isolated and reproducible under its documented configuration.

## 2. Test layers

### Unit tests

Test pure functions without MongoDB:

- Username normalization.
- Request schema validation.
- Error mapping.
- Password verification wrapper.
- Runtime-mode guard.

### Integration tests

Run against a disposable MongoDB database:

- Seed users.
- Create indexes.
- Find a user by username.
- Authenticate correct and incorrect credentials.
- Handle unavailable database.

### Security regression tests

These tests must remain after the demonstration code is replaced or refactored:

- Object password is rejected.
- Array password is rejected.
- Number password is rejected.
- Null password is rejected.
- Unknown request keys are rejected.
- Username object is rejected.
- A client cannot select an arbitrary collection or operator.
- Password or password hash is absent from responses and logs.

### Manual browser test

Use the browser to verify the user-visible flow, status text, error handling and lab-only labels.

## 3. Test matrix

| Case | Input | Expected secure result |
| --- | --- | --- |
| Correct credentials | Two valid strings | `200`, authenticated user |
| Wrong password | Valid username and wrong string | `401`, generic error |
| Unknown username | Unknown string username | `401`, generic error |
| Operator object | Password object | `400`, validation error |
| Array value | Password array | `400`, validation error |
| Number value | Password number | `400`, validation error |
| Null value | Password null | `400`, validation error |
| Unknown key | Extra body field | `400`, validation error |
| Username object | Username object | `400`, validation error |
| Oversized body | Body above limit | `413` or controlled `400` |
| Database down | MongoDB unavailable | `503`, no stack trace |
| Inactive user | `active=false` | `401`, generic error |

## 4. Example test payloads

Normal request:

```json
{
  "username": "alice",
  "password": "synthetic-demo-password"
}
```

Wrong password:

```json
{
  "username": "alice",
  "password": "wrong-password"
}
```

Object-type security regression:

```json
{
  "username": "alice",
  "password": {
    "$gt": ""
  }
}
```

The secure route must reject the object before the authentication query is executed.

## 5. Evidence checklist

- [ ] Test command and Node.js version recorded.
- [ ] MongoDB and driver versions recorded.
- [ ] Seed command recorded.
- [ ] Correct credentials result captured.
- [ ] Wrong credentials result captured.
- [ ] Object-type rejection captured.
- [ ] Database failure behavior captured.
- [ ] Secure response contains no password or hash.
- [ ] Logs contain no plaintext credential.
- [ ] Lab route is disabled outside local mode.

## 6. Future CI pipeline

A future GitHub Actions workflow should:

1. Install dependencies with the lockfile.
2. Start a disposable MongoDB service.
3. Run lint and unit tests.
4. Run integration and security regression tests.
5. Upload test output without secrets.

CI must never point tests at a personal or production database.