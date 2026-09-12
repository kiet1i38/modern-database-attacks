import test from "node:test";
import assert from "node:assert/strict";
import {
  validateSecureLoginBody,
  validateLabLoginBody
} from "../../src/modules/auth/validation.js";

test("secure validation accepts scalar credentials", () => {
  assert.deepEqual(
    validateSecureLoginBody({
      username: "Alice",
      password: "correct-password"
    }),
    {
      username: "alice",
      password: "correct-password"
    }
  );
});

test("secure validation rejects operator objects", () => {
  assert.throws(
    () => validateSecureLoginBody({
      username: "alice",
      password: { $gt: "" }
    }),
    { code: "INVALID_INPUT", statusCode: 400 }
  );
});

test("secure validation rejects unknown body fields", () => {
  assert.throws(
    () => validateSecureLoginBody({
      username: "alice",
      password: "password",
      role: "admin"
    }),
    { code: "INVALID_INPUT", statusCode: 400 }
  );
});

test("lab validation accepts the allowlisted operator payloads", () => {
  const payloads = [
    { $gt: "" },
    { $gte: "" },
    { $ne: "not-the-password" },
    { $regex: ".*" },
    { $nin: ["not-the-password"] },
    { $exists: true }
  ];

  for (const password of payloads) {
    assert.deepEqual(
      validateLabLoginBody({ username: "Alice", password }),
      { username: "alice", password }
    );
  }
});

test("lab validation rejects unsupported operator keys", () => {
  assert.throws(
    () => validateLabLoginBody({
      username: "alice",
      password: { $where: "this.password" }
    }),
    { code: "INVALID_INPUT", statusCode: 400 }
  );

  assert.throws(
    () => validateLabLoginBody({
      username: "alice",
      password: { gt: "" }
    }),
    { code: "INVALID_INPUT", statusCode: 400 }
  );
});

test("lab validation rejects arrays as password values", () => {
  assert.throws(
    () => validateLabLoginBody({
      username: "alice",
      password: []
    }),
    { code: "INVALID_INPUT", statusCode: 400 }
  );
});
