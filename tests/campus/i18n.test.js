import test from "node:test";
import assert from "node:assert/strict";
import { createCampusApp } from "../../src/campus/app.js";
import { resolveLocale } from "../../src/campus/i18n/locale.js";
import { translateApiMessage } from "../../src/campus/i18n/messages.js";
import { diagnostic, seedData } from "../../src/campus/domain.js";

test("Accept-Language resolves supported locales safely", () => {
  assert.equal(resolveLocale("en"), "en");
  assert.equal(resolveLocale("en-US,en;q=0.9"), "en");
  assert.equal(resolveLocale("vi-VN"), "vi");
  assert.equal(resolveLocale("fr,en;q=0.9"), "en");
  assert.equal(resolveLocale("fr"), "vi");
  assert.equal(resolveLocale("../../x"), "vi");
  assert.equal(resolveLocale(""), "vi");
  assert.equal(resolveLocale("en".repeat(130)), "vi");
});

test("API message catalogs localize known keys, interpolate safe params, and handle unknown keys", () => {
  assert.equal(translateApiMessage("errors.invalidCredentials", "en"), "Invalid username or password.");
  assert.equal(translateApiMessage("errors.invalidCredentials", "vi"), "Tên đăng nhập hoặc mật khẩu không đúng.");
  assert.equal(translateApiMessage("errors.fieldLength", "en", { min: 3, max: 40 }), "The value must be a string between 3 and 40 characters long.");
  assert.equal(translateApiMessage("missing.key", "en"), "The operation could not be completed.");
});

test("localized API responses keep status, code, and diagnostic security fields stable", async t => {
  const users = seedData(true).users;
  const sessions = new Map();
  const repo = {
    async getSession(id) { return sessions.get(id); },
    async setSession(id, data) { sessions.set(id, structuredClone(data)); },
    async deleteSession(id) { sessions.delete(id); },
    async userByUsername(username) { return users.find(user => user.username === username); },
    async userById(id) { return users.find(user => user.id === id); },
    async audit() {}
  };
  const server = createCampusApp({ repo, variant: "mongo-safe", secret: "test-only-session-secret-at-least-32-characters" }).listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  const base = "http://127.0.0.1:" + server.address().port + "/api";
  const initial = await fetch(base + "/auth/session", { headers: { "Accept-Language": "en-US,en;q=0.9" } });
  assert.equal(initial.headers.get("content-language"), "en");
  assert.equal((await initial.json()).user, null);
  let cookie = initial.headers.getSetCookie()[0].split(";")[0];
  const csrf = async headers => {
    const response = await fetch(base + "/auth/session", { headers: { cookie, ...headers } });
    return { token: (await response.json()).csrfToken, response };
  };
  const first = await csrf({ "Accept-Language": "en" });
  async function postLogin(username, password, language, token) {
    return fetch(base + "/auth/login", {
      method: "POST",
      headers: { cookie, "content-type": "application/json", "x-csrf-token": token, "Accept-Language": language },
      body: JSON.stringify({ username, password })
    });
  }
  const invalidEn = await postLogin("admin", { $gt: "" }, "en", first.token);
  const bodyEn = await invalidEn.json();
  assert.equal(invalidEn.status, 400);
  assert.equal(bodyEn.code, "INVALID_INPUT");
  assert.equal(bodyEn.messageKey, "errors.passwordMustBeString");
  assert.equal(bodyEn.message, "Password must be a string; an object cannot be used as an authentication condition.");
  assert.equal(bodyEn.diagnostic.authQueryExecuted, false);
  const invalidVi = await postLogin("admin", { $gt: "" }, "vi-VN", first.token);
  assert.equal(invalidVi.status, 400);
  assert.equal((await invalidVi.json()).message, "Mật khẩu phải là chuỗi; object không được dùng làm điều kiện xác thực.");

  const signedIn = await postLogin("admin", "Admin@123", "en", first.token);
  const signedBody = await signedIn.json();
  assert.equal(signedIn.status, 200);
  assert.equal(signedBody.user.role, "admin");
  assert.match(signedBody.diagnostic.explanation, /query only finds the username/i);
  cookie = signedIn.headers.getSetCookie()[0].split(";")[0];
  const signedSession = await fetch(base + "/auth/session", { headers: { cookie, "Accept-Language": "vi" } });
  const sessionBody = await signedSession.json();
  assert.equal(signedSession.headers.get("content-language"), "vi");
  assert.match(sessionBody.diagnostic.explanation, /Truy vấn chỉ tìm username/);
  assert.equal(sessionBody.diagnostic.queryTemplate, signedBody.diagnostic.queryTemplate);
  assert.equal(sessionBody.diagnostic.payload, signedBody.diagnostic.payload);
  assert.deepEqual(sessionBody.diagnostic.request, signedBody.diagnostic.request);
  const wrongPassword = await postLogin("admin", "wrong", "en", signedBody.csrfToken);
  const wrongBody = await wrongPassword.json();
  assert.equal(wrongPassword.status, 401);
  assert.equal(wrongBody.code, "INVALID_CREDENTIALS");
  assert.equal(wrongBody.messageKey, "errors.invalidCredentials");
  assert.equal(wrongBody.message, "Invalid username or password.");
});

test("diagnostic translation uses keys without changing SQL or MongoDB payload data", () => {
  const sql = diagnostic("sql-unsafe", { username: "admin", password: "' OR '1'='1' -- " }, true);
  const mongo = diagnostic("mongo-unsafe", { username: "admin", password: { $gt: "" } }, true);
  assert.equal(sql.explanationKey, "lab.unsafeSqlExplanation");
  assert.equal(sql.payload, "tautology");
  assert.ok(sql.queryTemplate.includes("ORDER BY role ASC"));
  assert.equal(mongo.explanationKey, "lab.unsafeMongoExplanation");
  assert.equal(mongo.payload, "gt");
  assert.deepEqual(mongo.request.password, { $gt: "" });
});
