import test from "node:test";
import assert from "node:assert/strict";
import { VARIANTS, SQL_PAYLOADS, MONGO_PAYLOADS, loginInput, publicUser, ticketInput, seedData, verifyPassword, diagnostic } from "../../src/campus/domain.js";

for (const variant of Object.keys(VARIANTS)) {
  test(variant + ": scalar credentials accepted without trimming SQL comment space", () => {
    const input = { username: "admin", password: "hello -- " };
    assert.deepEqual(loginInput(input, variant), input);
  });
  test(variant + ": rejects extra role, missing input and object username", () => {
    for (const body of [null, [], {}, { username: {}, password: "hi" }, { username: "admin", password: "hi", role: "admin" }]) {
      assert.throws(() => loginInput(body, variant), { code: "INVALID_INPUT" });
    }
    const longUsername = { username: "x".repeat(121), password: "hi" };
    if (variant.endsWith("-unsafe")) assert.deepEqual(loginInput(longUsername, variant), longUsername);
    else assert.throws(() => loginInput(longUsername, variant), { code: "INVALID_INPUT" });
  });
  test(variant + ": Mongo payload presets are accepted only by Mongo unsafe", () => {
    for (const payload of MONGO_PAYLOADS) {
      const body = { username: "admin", password: payload.password };
      if (variant === "mongo-unsafe") assert.deepEqual(loginInput(body, variant), body);
      else assert.throws(() => loginInput(body, variant), { status: 400 });
    }
  });
  test(variant + ": arbitrary JSON objects are accepted only by the intentionally unsafe Mongo login", () => {
    for (const password of [{ gt: "" }, { $where: "true" }, { $regex: "(a+)+" }, { $ne: {} }, { $nin: [{}] }, { $exists: "true" }, {}, { $gt: "", $ne: "" }, { nested: { $not: { $eq: "x" } } }]) {
      if (variant === "mongo-unsafe") assert.deepEqual(loginInput({ username: "admin", password }, variant).password, password);
      else assert.throws(() => loginInput({ username: "admin", password }, variant), { status: 400 });
    }
    for (const password of [[], null, 123, true]) assert.throws(() => loginInput({ username: "admin", password }, variant), { status: 400 });
  });
  test(variant + ": unsafe login accepts long manual payload strings within the JSON request limit", () => {
    const body = { username: "admin", password: "x".repeat(10_000) };
    if (variant === "sql-unsafe" || variant === "mongo-unsafe") assert.deepEqual(loginInput(body, variant), body);
    else assert.throws(() => loginInput(body, variant), { status: 400 });
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

test("rejection diagnostics redact custom credentials and distinguish JSON types", () => {
  for (const [password, type] of [[null, "null"], [[], "array"], [123, "number"], [{ secret: "private" }, "object"]]) {
    const detail = diagnostic("mongo-safe", { username: "private-user", password }, false, true);
    assert.equal(detail.inputType, type);
    assert.equal(detail.authQueryExecuted, false);
    assert.ok(!JSON.stringify(detail).includes("private"));
  }
});
test("known teaching payload is classified without normal password export", () => {
  assert.equal(diagnostic("sql-unsafe", SQL_PAYLOADS[0], true).payload, "tautology");
  assert.equal(diagnostic("mongo-unsafe", { username: "admin", password: { $gt: "" } }, true).payload, "gt");
});

test("diagnostics match every Mongo preset without walking rejected nested input", () => {
  for (const preset of MONGO_PAYLOADS) {
    assert.equal(diagnostic("mongo-safe", { username: "admin", password: preset.password }, false, true).payload, preset.id);
  }
  const nested = JSON.parse("[".repeat(7500) + "0" + "]".repeat(7500));
  for (const input of [
    { username: "admin", password: nested },
    { username: "admin", password: { $gt: nested } },
    { username: nested, password: { $gt: "" } }
  ]) {
    const detail = diagnostic("mongo-safe", input, false, true);
    assert.deepEqual(detail.request, { username: "[redacted]", password: "[redacted]" });
    assert.doesNotThrow(() => JSON.stringify(detail));
  }
});

test("unsafe explanations distinguish SQL strings from Mongo operators", () => {
  const sql = diagnostic("sql-unsafe", SQL_PAYLOADS[0], true).explanation;
  const mongo = diagnostic("mongo-unsafe", { username: "admin", password: MONGO_PAYLOADS[0].password }, true).explanation;
  assert.match(sql, /SQL/);
  assert.doesNotMatch(sql, /Object toán tử/);
  assert.match(mongo, /Object toán tử/);
});
test("ticket input validates enum/length and ignores forged owner/role", () => {
  const input = ticketInput({ title: "Help me", description: "A sufficiently long description", ownerId: "admin", role: "admin" });
  assert.equal(Object.hasOwn(input, "ownerId"), false);
  for (const body of [{ title: "x", description: "description" }, { title: "hello", description: "long enough description", priority: "urgent" }, { title: "hello", description: "long enough description", category: { $ne: "" } }]) {
    assert.throws(() => ticketInput(body), { status: 400 });
  }
});
