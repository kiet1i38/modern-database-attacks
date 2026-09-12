import { config } from "../src/config/env.js";
import { createDatabaseClient } from "../src/db/client.js";
import { ensureIndexes } from "../src/db/indexes.js";
import { COLLECTIONS } from "../src/db/collections.js";
import { hashPassword } from "../src/modules/auth/password.js";

const seedLab = process.argv.includes("--lab") || config.labMode;

if (config.nodeEnv === "production") {
  throw new Error("Refusing to seed demo credentials in production mode");
}

const dbClient = createDatabaseClient(config);

try {
  await dbClient.connect();
  const database = dbClient.db();
  await ensureIndexes(database);

  const now = new Date();

  await database.collection(COLLECTIONS.USERS).updateOne(
    { username: config.demoUsername },
    {
      $set: {
        username: config.demoUsername,
        passwordHash: hashPassword(config.secureDemoPassword),
        role: "student",
        active: true,
        updatedAt: now
      },
      $setOnInsert: {
        createdAt: now
      }
    },
    { upsert: true }
  );

  if (seedLab) {
    await database.collection(COLLECTIONS.LAB_USERS).updateOne(
      { username: config.demoUsername },
      {
        $set: {
          username: config.demoUsername,
          password: config.labDemoPassword,
          role: "student",
          active: true,
          updatedAt: now
        },
        $setOnInsert: {
          createdAt: now
        }
      },
      { upsert: true }
    );
  }

  console.log(JSON.stringify({
    ok: true,
    database: config.mongoDatabase,
    secureUserSeeded: true,
    labUserSeeded: seedLab
  }, null, 2));
} finally {
  await dbClient.close();
}
