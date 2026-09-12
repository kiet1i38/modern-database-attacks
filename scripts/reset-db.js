import { config } from "../src/config/env.js";
import { createDatabaseClient } from "../src/db/client.js";

if (config.nodeEnv === "production") {
  throw new Error("Refusing to reset a production database");
}

if (process.env.ALLOW_LOCAL_RESET !== "true") {
  throw new Error("Set ALLOW_LOCAL_RESET=true before resetting the local database");
}

if (!config.mongoDatabase.includes("modern_database_attacks")) {
  throw new Error("Database name is outside the expected local project namespace");
}

const dbClient = createDatabaseClient(config);

try {
  await dbClient.connect();
  await dbClient.db().dropDatabase();
  console.log(JSON.stringify({
    ok: true,
    droppedDatabase: config.mongoDatabase
  }, null, 2));
} finally {
  await dbClient.close();
}
