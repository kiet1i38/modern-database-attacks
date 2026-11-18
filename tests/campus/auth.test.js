import test from "node:test";
import assert from "node:assert/strict";
import { createCampusApp } from "../../src/campus/app.js";
import { seedData } from "../../src/campus/domain.js";

for (const variant of ["mongo-safe", "sql-safe"]) {
  test(variant + ": invalid types never reach credential lookup; valid login still works", async () => {
    const sessions = new Map();
    let lookups = 0, audits = 0;
    const account = seedData(true).users[0];
    const repo = {
      async getSession(id) { return sessions.get(id); },
      async setSession(id, data) { sessions.set(id, structuredClone(data)); },
      async deleteSession(id) { sessions.delete(id); },
      async audit() { audits++; },
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
      for (const password of [
        "[".repeat(7500) + "0" + "]".repeat(7500),
        '{"$gt":' + "[".repeat(7500) + "0" + "]".repeat(7500) + "}"
      ]) {
        const previousAudits = audits;
        const response = await fetch(base + "/login", {
          method: "POST", signal: AbortSignal.timeout(5000),
          headers: { cookie, "content-type": "application/json", "x-csrf-token": csrfToken },
          body: '{"username":"admin","password":' + password + "}"
        });
        assert.equal(response.status, 400);
        assert.equal((await response.json()).diagnostic.authQueryExecuted, false);
        assert.equal(audits, previousAudits + 1);
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

test("phase-two controls protect ticket access, roles, sessions, and error details", async t => {
  const { users, tickets } = seedData(true);
  const sessions = new Map();
  const audit = [];
  const internalError = "internal database detail for test";
  const repo = {
    async getSession(id) { return sessions.get(id); },
    async setSession(id, data) { sessions.set(id, structuredClone(data)); },
    async deleteSession(id) { sessions.delete(id); },
    async userByUsername(username) { return users.find(user => user.username === username); },
    async userById(id) { return users.find(user => user.id === id); },
    async tickets(ownerId) { return tickets.filter(ticket => ticket.ownerId === ownerId); },
    async ticketById(id) { return tickets.find(ticket => ticket.id === id); },
    async updateTicket(id, changes) { return Object.assign(await this.ticketById(id), changes); },
    async updateUser(id, changes) { return Object.assign(await this.userById(id), changes); },
    async createUser() { assert.fail("Student reached the account write"); },
    async audit(event) { audit.push(event); },
    async events() { throw new Error(internalError); }
  };
  async function listen(variant) {
    const secret = "test-only-session-secret-at-least-32-characters";
    const server = createCampusApp({ repo, variant, secret }).listen(0, "127.0.0.1");
    await new Promise(resolve => server.once("listening", resolve));
    t.after(async () => {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    });
    return "http://127.0.0.1:" + server.address().port + "/api";
  }
  const base = await listen("mongo-safe");
  async function login(username, password) {
    const initial = await fetch(base + "/auth/session");
    const signedIn = await fetch(base + "/auth/login", {
      method: "POST",
      headers: {
        cookie: initial.headers.getSetCookie()[0].split(";")[0],
        "content-type": "application/json",
        "x-csrf-token": (await initial.json()).csrfToken
      },
      body: JSON.stringify({ username, password })
    });
    assert.equal(signedIn.status, 200);
    const cookie = signedIn.headers.getSetCookie()[0].split(";")[0];
    const { csrfToken, user } = await signedIn.json();
    return {
      cookie, user,
      request(route, method = "GET", body) {
        return fetch(base + route, {
          method,
          headers: { cookie, "content-type": "application/json", "x-csrf-token": csrfToken },
          body: JSON.stringify(body)
        });
      }
    };
  }
  const student = await login("student", "Student@123");
  const administrator = await login("admin", "Admin@123");
  const owned = tickets.find(ticket => ticket.ownerId === student.user.id && ticket.status === "in_progress");
  const other = tickets.find(ticket => ticket.ownerId !== student.user.id);
  const list = await student.request("/tickets");
  assert.equal(list.status, 200);
  const { items } = await list.json();
  assert.ok(items.length > 0 && items.every(ticket => ticket.ownerId === student.user.id));
  assert.equal((await student.request("/tickets/" + owned.id)).status, 200);
  assert.equal((await student.request("/tickets/" + other.id)).status, 403);
  assert.equal((await student.request("/admin/audit")).status, 403);

  const ticketPath = "/tickets/" + owned.id;
  assert.equal((await student.request(ticketPath, "PATCH", { status: "resolved" })).status, 403);
  assert.equal(owned.status, "in_progress");
  assert.equal((await student.request("/admin/users", "POST", {})).status, 403);
  assert.equal((await student.request("/profile", "PATCH", { role: "admin" })).status, 400);
  assert.equal((await administrator.request(ticketPath, "PATCH", { status: "resolved" })).status, 200);
  assert.equal((await (await student.request(ticketPath)).json()).ticket.status, "resolved");

  const name = "Minh Anh O'Connor";
  assert.equal((await student.request("/profile", "PATCH", { name })).status, 200);
  const current = (await (await student.request("/auth/me")).json()).user;
  assert.equal(current.name, name);
  assert.equal(current.role, "user");
  assert.ok(!Object.hasOwn(current, "password") && !Object.hasOwn(current, "passwordHash"));
  assert.equal(audit.length, 2);
  for (const credential of ["Student@123", "Admin@123", "csrfToken", student.cookie]) {
    assert.ok(!JSON.stringify(audit).includes(credential));
  }

  const failure = await administrator.request("/admin/audit");
  assert.equal(failure.status, 503);
  assert.ok(!(await failure.text()).includes(internalError));

  const otherVariant = await listen("sql-safe");
  assert.equal((await fetch(otherVariant + "/auth/me", { headers: { cookie: student.cookie } })).status, 401);
  assert.equal((await administrator.request("/admin/users/" + student.user.id, "PATCH", { active: false })).status, 200);
  assert.equal((await student.request("/auth/me")).status, 401);
  assert.equal((await administrator.request("/auth/logout", "POST")).status, 200);
  assert.equal((await administrator.request("/auth/me")).status, 401);
});
