import test from "node:test";
import assert from "node:assert/strict";
import { createCampusApp } from "../../src/campus/app.js";
import { seedData } from "../../src/campus/domain.js";

for (const variant of ["mongo-safe", "sql-safe"]) {
  test(variant + ": invalid types never reach credential lookup; valid login still works", async () => {
    const sessions = new Map();
    let lookups = 0;
    const account = seedData(true).users[0];
    const repo = {
      async getSession(id) { return sessions.get(id); },
      async setSession(id, data) { sessions.set(id, structuredClone(data)); },
      async deleteSession(id) { sessions.delete(id); },
      async audit() {},
      async userByUsername() { lookups++; return account; },
      async unsafeLogin() { assert.fail("Safe variant called vulnerable lookup"); }
    };
    const server = createCampusApp({ repo, variant, secret: "test-only-session-secret-at-least-32-characters" }).listen(0, "127.0.0.1");
    await new Promise(resolve => server.once("listening", resolve));
    const base = "http://127.0.0.1:" + server.address().port + "/api/auth";
    try {
      const initial = await fetch(base + "/session");
      const cookie = initial.headers.getSetCookie()[0].split(";")[0];
      const { csrfToken } = await initial.json();
      const login = password => fetch(base + "/login", {
        method: "POST", signal: AbortSignal.timeout(5000),
        headers: { cookie, "content-type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ username: "admin", password })
      });
      for (const password of [{ $gt: "" }, [], null, 123, true, undefined]) {
        const response = await login(password);
        assert.equal(response.status, 400);
        assert.equal((await response.json()).diagnostic.authQueryExecuted, false);
        assert.equal(lookups, 0);
      }
      const literal = await login('{"$gt":""}');
      assert.equal(literal.status, 401);
      assert.equal((await literal.json()).diagnostic.authQueryExecuted, true);
      assert.equal(lookups, 1);
      const valid = await login("Admin@123");
      assert.equal(valid.status, 200);
      assert.equal((await valid.json()).user.role, "admin");
      assert.equal(lookups, 2);
    } finally {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  });
}
