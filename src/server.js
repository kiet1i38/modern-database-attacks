import { config } from "./config/env.js";
import { createDatabaseClient } from "./db/client.js";
import { ensureIndexes } from "./db/indexes.js";
import { createApp } from "./app.js";

const dbClient = createDatabaseClient(config);

async function start() {
  await dbClient.connect();
  await ensureIndexes(dbClient.db());

  const app = createApp({
    config,
    dbClient
  });

  const server = app.listen(config.port, config.host, () => {
    console.log(
      config.serviceName + " listening on http://" + config.host + ":" + config.port
    );
    console.log(
      "Lab mode: " + (config.labMode && config.nodeEnv !== "production" ? "enabled" : "disabled")
    );
  });

  const shutdown = async (signal) => {
    console.log("Received " + signal + "; shutting down");
    server.close(async () => {
      await dbClient.close();
      process.exit(0);
    });
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

start().catch(async (error) => {
  console.error("Startup failed: " + error.message);
  await dbClient.close();
  process.exit(1);
});
