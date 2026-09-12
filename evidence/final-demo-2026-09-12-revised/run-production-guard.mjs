import { createServer } from "node:http";
import { createApp } from "../../src/app.js";

const dbClient = {
  db: () => ({
    collection: () => ({
      findOne: async () => null
    })
  }),
  ping: async () => true
};

const app = createApp({
  config: {
    nodeEnv: "production",
    labMode: true,
    jsonBodyLimit: "16kb",
    serviceName: "guard-test"
  },
  dbClient
});

const server = createServer(app);

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

try {
  const address = server.address();
  const response = await fetch(
    "http://127.0.0.1:" + address.port + "/api/lab/login-observation",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: "alice",
        password: { $gt: "" }
      })
    }
  );

  console.log(JSON.stringify({
    status: response.status,
    body: await response.json()
  }));
} finally {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}
