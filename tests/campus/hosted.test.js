import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import mysql from "mysql2/promise";
import { MongoClient } from "mongodb";
import { createHostedHandler, loadHostedConfig } from "../../src/campus/hosted.js";
import { createRepository } from "../../src/campus/repository.js";
import { seedData } from "../../src/campus/domain.js";

const environment = {
  CAMPUS_HOSTED_DEMO: "true", VARIANT: "mongo-safe",
  SESSION_SECRET: "test-only-hosted-secret-at-least-32-characters",
  MONGODB_URI: "mongodb+srv://example.invalid",
  MYSQL_HOST: "example.invalid", MYSQL_USER: "demo", MYSQL_PASSWORD: "test-only", MYSQL_SSL: "true",
  CAMPUS_SQL_SAFE_URL: "https://sql-safe.example"
};

async function listen(handler, t) {
  const server = createServer(handler).listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  return "http://127.0.0.1:" + server.address().port;
}

test("hosted config validates opt-in, secrets, databases and HTTPS variant links", () => {
  for (const variant of ["sql-safe", "mongo-safe"]) {
    const config = loadHostedConfig({ ...environment, VARIANT: variant });
    assert.equal(config.variant, variant);
    assert.equal(config.hosted, true);
    assert.equal(config.sessionMaxAge, 1800000);
    assert.equal(config.variantUrls["sql-safe"], "https://sql-safe.example");
  }
  for (const changes of [
    { CAMPUS_HOSTED_DEMO: undefined }, { VARIANT: "__proto__" }, { SESSION_SECRET: "short" },
    { VARIANT: "sql-unsafe" }, { VARIANT: "mongo-unsafe" }, { VERCEL_ENV: "production" },
    { MONGODB_URI: undefined }, { MONGODB_URI: "mongodb://localhost" },
    { SESSION_MAX_AGE_MS: "NaN" }, { SESSION_MAX_AGE_MS: "0" }, { SESSION_MAX_AGE_MS: "1.5" },
    { VARIANT: "sql-safe", MYSQL_HOST: undefined }, { VARIANT: "sql-safe", MYSQL_PASSWORD: undefined },
    { VARIANT: "sql-safe", MYSQL_SSL: "false" }, { VARIANT: "sql-safe", MYSQL_PORT: "bad" },
    { CAMPUS_SQL_SAFE_URL: "http://sql-safe.example" }, { CAMPUS_SQL_SAFE_URL: "https://sql-safe.example/path" },
    { CAMPUS_SQL_SAFE_URL: "https://user:password@sql-safe.example" }
  ]) assert.throws(() => loadHostedConfig({ ...environment, ...changes }));
  const config = loadHostedConfig({ ...environment, VERCEL_ENV: "preview", CAMPUS_SQL_UNSAFE_URL: "https://sql-unsafe.example" });
  assert.equal(config.variantUrls["sql-unsafe"], undefined);
});

test("hosted SQL passes verified TLS and the selected database to the existing driver", async t => {
  let options;
  t.mock.method(mysql, "createPool", value => { options = value; return { async end() {} }; });
  const repo = await createRepository("sql-safe", { ...environment, CAMPUS_DATABASE: "isolated_demo", MYSQL_SSL_CA: "test-ca" });
  assert.equal(repo.databaseName, "isolated_demo");
  assert.equal(options.database, "isolated_demo");
  assert.deepEqual(options.ssl, { rejectUnauthorized: true, ca: "test-ca" });
  assert.equal(options.multipleStatements, false);
  await repo.close();
  const local = await createRepository("sql-safe", {});
  assert.equal(options.database, "campus_sql_safe");
  assert.equal(options.ssl, undefined);
  await local.close();
});

test("hosted MongoDB enforces TLS and rejects connection strings that disable it", async t => {
  let options;
  t.mock.method(MongoClient.prototype, "connect", async function () { options = this.options; return this; });
  const repo = await createRepository("mongo-safe", { ...environment, CAMPUS_DATABASE: "isolated_mongo_demo" });
  assert.equal(repo.databaseName, "isolated_mongo_demo");
  assert.equal(options.tls, true);
  assert.equal(options.rejectUnauthorized, true);
  await repo.close();
  await assert.rejects(() => createRepository("mongo-safe", { ...environment, MONGODB_URI: "mongodb+srv://example.invalid/?tls=false" }));
});

test("hosted handlers reuse connections, accept same-origin HTTPS and share persistent sessions", async t => {
  const sessions = new Map(), account = seedData(true).users[0];
  let connections = 0;
  const repo = {
    async getSession(id) { return sessions.get(id); },
    async setSession(id, data) { sessions.set(id, structuredClone(data)); },
    async deleteSession(id) { sessions.delete(id); },
    async userByUsername(username) { return username === account.username ? account : null; },
    async userById(id) { return id === account.id ? account : null; },
    async audit() {},
    async ping() {},
    async setup() { assert.fail("Requests must not seed or run schema setup"); }
  };
  const connect = async () => { connections++; await Promise.resolve(); return repo; };
  const base = await listen(createHostedHandler({ env: environment, connect }), t);
  const headers = { "x-forwarded-proto": "https" };
  const configs = await Promise.all([fetch(base + "/api/config", { headers }), fetch(base + "/api/config", { headers })]);
  assert.equal(connections, 1);
  for (const response of configs) {
    assert.equal(response.status, 200);
    const config = await response.json();
    assert.equal(config.localOnly, false);
    assert.equal(config.variants["sql-safe"].url, "https://sql-safe.example");
    assert.ok(!JSON.stringify(config).includes(environment.SESSION_SECRET));
  }
  const initial = await fetch(base + "/api/auth/session", { headers });
  const initialCookie = initial.headers.getSetCookie()[0];
  assert.match(initialCookie, /; Secure/);
  assert.match(initialCookie, /; HttpOnly/);
  assert.match(initialCookie, /; SameSite=Strict/);
  const { csrfToken } = await initial.json();
  const loginHeaders = { ...headers, cookie: initialCookie.split(";")[0], "content-type": "application/json", "x-csrf-token": csrfToken };
  const body = JSON.stringify({ username: "admin", password: "Admin@123" });
  const denied = await fetch(base + "/api/auth/login", { method: "POST", headers: { ...loginHeaders, origin: "https://other.example" }, body });
  assert.equal(denied.status, 403);
  const login = await fetch(base + "/api/auth/login", { method: "POST", headers: { ...loginHeaders, origin: base.replace("http:", "https:") }, body });
  assert.equal(login.status, 200, await login.text());
  const cookie = login.headers.getSetCookie()[0].split(";")[0];
  assert.notEqual(cookie, loginHeaders.cookie);
  const second = await listen(createHostedHandler({ env: environment, connect }), t);
  const me = await fetch(second + "/api/auth/me", { headers: { ...headers, cookie } });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).user.role, "admin");
  assert.equal(connections, 2);
  const missing = await fetch(base + "/api/missing", { headers: { ...headers, cookie } });
  assert.equal(missing.status, 404);
  assert.match(missing.headers.get("content-type"), /application\/json/);
});

test("hosted initialization retries after failure and hides connection credentials", async t => {
  let attempts = 0;
  const connect = async () => {
    attempts++;
    if (attempts === 1) throw new Error("database-password-must-not-be-returned");
    return { async ping() {} };
  };
  const base = await listen(createHostedHandler({ env: environment, connect }), t);
  const failed = await fetch(base + "/api/health");
  assert.equal(failed.status, 503);
  assert.equal(failed.headers.get("cache-control"), "no-store");
  assert.ok(!(await failed.text()).includes("database-password"));
  assert.equal((await fetch(base + "/api/health")).status, 200);
  assert.equal(attempts, 2);
  const invalid = await listen(createHostedHandler({ env: {}, connect: () => assert.fail("Invalid config reached database") }), t);
  assert.equal((await fetch(invalid + "/api/health")).status, 503);
});
