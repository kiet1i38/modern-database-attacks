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

test("lab validation accepts a structured payload for the local experiment", () => {
  assert.deepEqual(
    validateLabLoginBody({
      username: "Alice",
      password: { $gt: "" }
    }),
    {
      username: "alice",
      password: { $gt: "" }
    }
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
