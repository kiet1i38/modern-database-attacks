import test from "node:test";
import assert from "node:assert/strict";
import { createCampusApp } from "../../src/campus/app.js";
import { createLiveLabRepository, validateLiveLabConfig } from "../../src/campus/live-lab.js";
import { seedData } from "../../src/campus/domain.js";

const sqlLocal = {
  CAMPUS_SQL_STACKED_LAB: "true",
  CAMPUS_SQL_LAB_URL: "mysql://campus_lab:local-only@mysql:3306/campus_sql_unsafe_lab"
};
const mongoLocal = {
  CAMPUS_MONGO_DELETE_LAB: "true",
  CAMPUS_MONGO_LAB_URI: "mongodb://mongodb:27017/campus_mongo_unsafe_lab"
};

test("live-lab configuration stays inside the named unsafe sandbox databases", async () => {
  assert.deepEqual(validateLiveLabConfig("sql-unsafe", sqlLocal), { sqlEnabled: true, mongoEnabled: false });
  assert.deepEqual(validateLiveLabConfig("mongo-unsafe", mongoLocal), { sqlEnabled: false, mongoEnabled: true });
  assert.deepEqual(validateLiveLabConfig("sql-safe", {}), { sqlEnabled: false, mongoEnabled: false });
  assert.throws(() => validateLiveLabConfig("sql-safe", sqlLocal), /restricted to sql-unsafe/);
  assert.throws(() => validateLiveLabConfig("mongo-safe", mongoLocal), /restricted to mongo-unsafe/);
  assert.throws(() => validateLiveLabConfig("sql-unsafe", { ...sqlLocal, CAMPUS_SQL_LAB_URL: "mysql://u:p@mysql:3306/campus_sql_unsafe" }), /isolated campus_sql_unsafe_lab/);
  assert.throws(() => validateLiveLabConfig("sql-unsafe", { ...sqlLocal, CAMPUS_SQL_LAB_URL: "mysql://u:p@localhost:3306/campus_sql_unsafe_lab", CAMPUS_HOSTED_DEMO: "true" }), /dedicated remote sandbox/);
  assert.throws(() => validateLiveLabConfig("sql-unsafe", { ...sqlLocal, CAMPUS_SQL_LAB_URL: "mysql://u:p@db.example:3306/campus_sql_unsafe_lab?ssl=false", CAMPUS_HOSTED_DEMO: "true" }), /TLS cannot be disabled/);
  assert.throws(() => validateLiveLabConfig("mongo-unsafe", { ...mongoLocal, CAMPUS_MONGO_LAB_URI: "mongodb://mongodb:27017/campus_mongo_unsafe" }), /isolated campus_mongo_unsafe_lab/);
  assert.throws(() => validateLiveLabConfig("mongo-unsafe", { ...mongoLocal, CAMPUS_MONGO_LAB_URI: "mongodb://mongodb:27017/campus_mongo_unsafe_lab", CAMPUS_HOSTED_DEMO: "true" }), /credentialed TLS-enabled Atlas/);
  assert.throws(() => validateLiveLabConfig("mongo-unsafe", { ...mongoLocal, CAMPUS_MONGO_LAB_URI: "mongodb+srv://lab:secret@cluster.example/campus_mongo_unsafe_lab?tls=false", CAMPUS_HOSTED_DEMO: "true" }), /TLS cannot be disabled/);
  assert.equal(await createLiveLabRepository("sql-safe", {}), null);
});

test("live-lab routes require an authenticated CSRF-protected session and stay scoped by engine", async t => {
  const account = seedData(false).users.find(user => user.username === "admin");
  const sessions = new Map();
  const repo = {
    async getSession(id) { return sessions.get(id); },
    async setSession(id, data) { sessions.set(id, structuredClone(data)); },
    async deleteSession(id) { sessions.delete(id); },
    async unsafeLogin() { return account; },
    async userById(id) { return id === account.id ? account : null; },
    async audit() {}
  };
  const calls = [];
  const lab = {
    enabled: true,
    kind: "sql",
    async state() { return { kind: "sql", database: "campus_sql_unsafe_lab", eventsTableExists: true, events: [] }; },
    async login(...args) { calls.push(["login", ...args]); return { mode: args[0], matched: false, user: null, query: "SELECT ..." }; },
    async reset() { calls.push(["reset"]); return { kind: "sql", database: "campus_sql_unsafe_lab", eventsTableExists: true, events: [] }; },
    async deleteOwner(...args) { calls.push(["delete", ...args]); return { mode: args[0], deletedCount: 0 }; }
  };
  const server = createCampusApp({ repo, lab, variant: "sql-unsafe", secret: "test-only-session-secret-at-least-32-characters" }).listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const base = "http://127.0.0.1:" + server.address().port + "/api";

  const publicConfig = await fetch(base + "/config");
  assert.equal((await publicConfig.json()).liveLab, true);
  const initial = await fetch(base + "/auth/session");
  const initialCookie = initial.headers.getSetCookie()[0].split(";")[0];
  const initialData = await initial.json();
  assert.equal((await fetch(base + "/live-lab/state", { headers: { cookie: initialCookie } })).status, 401);
  const login = await fetch(base + "/auth/login", {
    method: "POST",
    headers: { cookie: initialCookie, "content-type": "application/json", "x-csrf-token": initialData.csrfToken },
    body: JSON.stringify({ username: "admin", password: "synthetic" })
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.getSetCookie()[0].split(";")[0];
  const loginData = await login.json();
  const headers = { cookie, "content-type": "application/json", "x-csrf-token": loginData.csrfToken };

  const state = await fetch(base + "/live-lab/state", { headers: { cookie } });
  assert.equal(state.status, 200);
  assert.equal((await state.json()).database, "campus_sql_unsafe_lab");
  const noCsrf = await fetch(base + "/live-lab/reset", { method: "POST", headers: { cookie, "content-type": "application/json" }, body: "{}" });
  assert.equal(noCsrf.status, 403);
  const safeLogin = await fetch(base + "/live-lab/login", { method: "POST", headers, body: JSON.stringify({ mode: "safe", username: "labadmin", password: "' OR '1'='1' -- " }) });
  assert.equal(safeLogin.status, 200);
  assert.deepEqual(calls[0], ["login", "safe", "labadmin", "' OR '1'='1' -- "]);
  const longPayload = "x".repeat(20000);
  const largeLogin = await fetch(base + "/live-lab/login", { method: "POST", headers, body: JSON.stringify({ mode: "safe", username: "labadmin", password: longPayload }) });
  assert.equal(largeLogin.status, 200);
  assert.equal(calls.at(-1)[3].length, 20000);
  const wrongEngine = await fetch(base + "/live-lab/delete", { method: "POST", headers, body: JSON.stringify({ mode: "unsafe", owner: { $ne: "alice" } }) });
  assert.equal(wrongEngine.status, 404);
  const reset = await fetch(base + "/live-lab/reset", { method: "POST", headers, body: "{}" });
  assert.equal(reset.status, 200);
  assert.deepEqual(calls.at(-1), ["reset"]);
});

test("hosted lab URLs require exact database names and TLS remote endpoints", () => {
  const hostedSql = {
    CAMPUS_HOSTED_DEMO: "true", CAMPUS_SQL_STACKED_LAB: "true",
    CAMPUS_SQL_LAB_URL: "mysql://lab-user:secret@db.example:4000/campus_sql_unsafe_lab"
  };
  const hostedMongo = {
    CAMPUS_HOSTED_DEMO: "true", CAMPUS_MONGO_DELETE_LAB: "true",
    CAMPUS_MONGO_LAB_URI: "mongodb+srv://lab-user:secret@cluster.example/campus_mongo_unsafe_lab"
  };
  assert.equal(validateLiveLabConfig("sql-unsafe", hostedSql).sqlEnabled, true);
  assert.equal(validateLiveLabConfig("mongo-unsafe", hostedMongo).mongoEnabled, true);
  assert.throws(() => validateLiveLabConfig("sql-unsafe", { ...hostedSql, CAMPUS_SQL_LAB_URL: "mysql://lab-user:secret@db.example:4000/campus_sql_safe" }));
  assert.throws(() => validateLiveLabConfig("mongo-unsafe", { ...hostedMongo, CAMPUS_MONGO_LAB_URI: "mongodb+srv://lab-user:secret@cluster.example/campusdesk" }));
});
