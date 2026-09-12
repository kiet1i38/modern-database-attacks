import test from "node:test";
import assert from "node:assert/strict";
import {
  hashPassword,
  verifyPassword
} from "../../src/modules/auth/password.js";

test("password hash verifies only the original value", () => {
  const hash = hashPassword("synthetic-password");

  assert.notEqual(hash, "synthetic-password");
  assert.equal(verifyPassword("synthetic-password", hash), true);
  assert.equal(verifyPassword("wrong-password", hash), false);
});

test("malformed password hashes fail closed", () => {
  assert.equal(verifyPassword("anything", "not-a-hash"), false);
});
