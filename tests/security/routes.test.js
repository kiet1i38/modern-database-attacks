import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createApp } from "../../src/app.js";
import { hashPassword } from "../../src/modules/auth/password.js";

function createFakeDatabase() {
  const calls = [];

  const secureUser = {
    username: "alice",
    passwordHash: hashPassword("synthetic-demo-password"),
    role: "student",
    active: true
  };

  const labUser = {
    username: "alice",
    password: "lab-only-demo-password",
    role: "student",
    active: true
  };

  const database = {
    collection(name) {
      return {
        async findOne(query) {
          calls.push({ name, query });

          if (name === "users") {
            return query.username === secureUser.username
              && query.active === true
              ? secureUser
              : null;
          }

          if (name === "lab_users") {
            if (query.username !== labUser.username) {
              return null;
            }

            if (query.password === labUser.password) {
              return labUser;
            }

            if (query.password?.$gt === "") {
              return labUser;
            }

            return null;
          }

          return null;
        }
      };
    }
  };

  return { database, calls };
}

async function startTestServer(config) {
  const fake = createFakeDatabase();
  const dbClient = {
    db: () => fake.database,
    ping: async () => true
  };
  const app = createApp({ config, dbClient });
  const server = createServer(app);

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();

  return {
    fake,
    server,
    url: "http://127.0.0.1:" + address.port
  };
}

async function stopTestServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

const baseConfig = {
  nodeEnv: "test",
  labMode: true,
  jsonBodyLimit: "16kb",
  serviceName: "test-service"
};

test("secure route rejects object passwords before database lookup", async (t) => {
  const running = await startTestServer(baseConfig);
  t.after(() => stopTestServer(running.server));

  const response = await fetch(running.url + "/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: "alice",
      password: { $gt: "" }
    })
  });

  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.error.code, "INVALID_INPUT");
  assert.equal(running.fake.calls.length, 0);
});

test("secure route accepts correct scalar credentials", async (t) => {
  const running = await startTestServer(baseConfig);
  t.after(() => stopTestServer(running.server));

  const response = await fetch(running.url + "/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: "alice",
      password: "synthetic-demo-password"
    })
  });

  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.user.username, "alice");
});

test("lab route demonstrates object-shaped operator behavior in the isolated test double", async (t) => {
  const running = await startTestServer(baseConfig);
  t.after(() => stopTestServer(running.server));

  const response = await fetch(running.url + "/api/lab/login-observation", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: "alice",
      password: { $gt: "" }
    })
  });

  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.authenticated, true);
  assert.equal(body.mode, "lab");
  assert.equal(body.inputType, "object");
});

test("lab route is unavailable when LAB_MODE is disabled", async (t) => {
  const running = await startTestServer({
    ...baseConfig,
    labMode: false
  });
  t.after(() => stopTestServer(running.server));

  const response = await fetch(running.url + "/api/lab/login-observation", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: "alice",
      password: { $gt: "" }
    })
  });

  assert.equal(response.status, 404);
});
