import test from "node:test";
import assert from "node:assert/strict";
import { createCampusApp } from "../../src/campus/app.js";
import { seedData } from "../../src/campus/domain.js";

test("manual presentation has no public one-click scenario endpoint", async t => {
  const sessions = new Map();
  const users = seedData(true).users;
  let scenarioRuns = 0, resets = 0;
  const repo = {
    async getSession(id) { return sessions.get(id); },
    async setSession(id, data) { sessions.set(id, structuredClone(data)); },
    async deleteSession(id) { sessions.delete(id); },
    async userByUsername(username) { return users.find(user => user.username === username); },
    async userById(id) { return users.find(user => user.id === id); },
    async audit() {},
    async resetDemoSeed() { resets++; return { usersRestored: 3, ticketsRestored: 12 }; },
    async runSecurityScenario() { scenarioRuns++; return {}; }
  };
  const server = createCampusApp({ repo, variant: "sql-safe", secret: "test-only-session-secret-at-least-32-characters" }).listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  const base = "http://127.0.0.1:" + server.address().port + "/api";

  async function session() {
    const response = await fetch(base + "/auth/session");
    return { cookie: response.headers.getSetCookie()[0].split(";")[0], ...(await response.json()) };
  }
  async function signIn(username, password) {
    const initial = await session();
    const response = await fetch(base + "/auth/login", {
      method: "POST",
      headers: { cookie: initial.cookie, "content-type": "application/json", "x-csrf-token": initial.csrfToken },
      body: JSON.stringify({ username, password })
    });
    assert.equal(response.status, 200);
    return { cookie: response.headers.getSetCookie()[0].split(";")[0], ...(await response.json()) };
  }
  async function post(cookie, csrfToken, route, body = {}) {
    return fetch(base + route, {
      method: "POST",
      headers: { cookie, "content-type": "application/json", ...(csrfToken ? { "x-csrf-token": csrfToken } : {}) },
      body: JSON.stringify(body)
    });
  }

  const guest = await session();
  assert.equal((await post(guest.cookie, guest.csrfToken, "/security-scenarios/run", { scenarioId: "bulk-delete" })).status, 401);
  assert.equal(scenarioRuns, 0);

  const admin = await signIn("admin", "Admin@123");
  assert.equal((await post(admin.cookie, admin.csrfToken, "/security-scenarios/run", { scenarioId: "bulk-delete" })).status, 404);
  assert.equal(scenarioRuns, 0);
  assert.equal((await post(guest.cookie, guest.csrfToken, "/admin/demo/reset")).status, 401);
  assert.equal((await post(admin.cookie, undefined, "/admin/demo/reset")).status, 403);
  const restored = await post(admin.cookie, admin.csrfToken, "/admin/demo/reset");
  assert.equal(restored.status, 200);
  assert.deepEqual(await restored.json(), { ok: true, scope: "seed-users-and-tickets", usersRestored: 3, ticketsRestored: 12 });
  assert.equal(resets, 1);

  const student = await signIn("student", "Student@123");
  assert.equal((await post(student.cookie, student.csrfToken, "/admin/demo/reset")).status, 403);
  assert.equal(resets, 1);
});
