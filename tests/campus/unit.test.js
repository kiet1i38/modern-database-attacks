import test from "node:test";
import assert from "node:assert/strict";
import { VARIANTS, SQL_PAYLOADS, MONGO_PAYLOADS, loginInput, publicUser, ticketInput, seedData, verifyPassword, diagnostic } from "../../src/campus/domain.js";

for (const variant of Object.keys(VARIANTS)) {
  test(variant + ": scalar credentials accepted without trimming SQL comment space", () => {
    const input = { username: "admin", password: "hello -- " };
    assert.deepEqual(loginInput(input, variant), input);
  });
  test(variant + ": rejects extra role, missing input and object username", () => {
    for (const body of [null, [], {}, { username: {}, password: "hi" }, { username: "admin", password: "hi", role: "admin" }, { username: "x".repeat(121), password: "hi" }]) {
      assert.throws(() => loginInput(body, variant), { code: "INVALID_INPUT" });
    }
  });
  test(variant + ": six Mongo payloads only accepted by Mongo unsafe", () => {
    for (const payload of MONGO_PAYLOADS) {
      const body = { username: "admin", password: payload.password };
      if (variant === "mongo-unsafe") assert.deepEqual(loginInput(body, variant), body);
      else assert.throws(() => loginInput(body, variant), { status: 400 });
    }
  });
  test(variant + ": password objects cannot use gt typo, $where, arbitrary regex, nested values or arrays", () => {
    for (const password of [{ gt: "" }, { $where: "true" }, { $regex: "(a+)+" }, { $ne: {} }, { $nin: [{}] }, { $exists: "true" }, [], {}, { $gt: "", $ne: "" }]) {
      assert.throws(() => loginInput({ username: "admin", password }, variant), { status: 400 });
    }
  });
}
test("public users never export hashes/plaintext password", () => {
  const user = seedData(true).users[0];
  assert.equal(publicUser(user).role, "admin");
  assert.equal(Object.hasOwn(publicUser(user), "password"), false);
  assert.equal(Object.hasOwn(publicUser(user), "passwordHash"), false);
});
test("safe seed stores scrypt and no plaintext", () => {
  const { users, tickets } = seedData(true);
  assert.equal(users.length, 3); assert.equal(tickets.length, 12);
  assert.equal(users[0].password, null);
  assert.ok(verifyPassword("Admin@123", users[0].passwordHash));
  assert.ok(!verifyPassword("wrong", users[0].passwordHash));
});
test("unsafe synthetic seed deliberately stores comparable password", () => {
  const user = seedData(false).users[0];
  assert.equal(user.password, "Admin@123"); assert.equal(user.passwordHash, null);
});
test("ordinary diagnostics redact username and password", () => {
  const detail = diagnostic("sql-safe", { username: "someone", password: "sensitive" }, true);
  assert.ok(!JSON.stringify(detail).includes("sensitive")); assert.ok(!JSON.stringify(detail).includes("someone"));
});
test("known teaching payload is classified without normal password export", () => {
  assert.equal(diagnostic("sql-unsafe", SQL_PAYLOADS[0], true).payload, "tautology");
  assert.equal(diagnostic("mongo-unsafe", { username: "admin", password: { $gt: "" } }, true).payload, "gt");
});
test("ticket input validates enum/length and ignores forged owner/role", () => {
  const input = ticketInput({ title: "Help me", description: "A sufficiently long description", ownerId: "admin", role: "admin" });
  assert.equal(Object.hasOwn(input, "ownerId"), false);
  for (const body of [{ title: "x", description: "description" }, { title: "hello", description: "long enough description", priority: "urgent" }, { title: "hello", description: "long enough description", category: { $ne: "" } }]) {
    assert.throws(() => ticketInput(body), { status: 400 });
  }
});
