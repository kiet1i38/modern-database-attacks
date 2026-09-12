import test from "node:test";
import assert from "node:assert/strict";
import { config } from "../../src/config/env.js";
import { createDatabaseClient } from "../../src/db/client.js";
import { ensureIndexes } from "../../src/db/indexes.js";
import { COLLECTIONS } from "../../src/db/collections.js";

test("real MongoDB evaluates the documented operator payloads", async () => {
  const dbClient = createDatabaseClient({
    mongoUri: config.mongoUri,
    mongoDatabase: config.mongoTestDatabase
  });

  await dbClient.connect();
  const database = dbClient.db();
  await ensureIndexes(database);

  const username = "integration-alice";
  const password = "synthetic-integration-password";
  const collection = database.collection(COLLECTIONS.LAB_USERS);

  try {
    await collection.deleteMany({ username });
    await collection.insertOne({
      username,
      password,
      active: true
    });

    const normal = await collection.findOne({
      username,
      password
    });

    const operatorPayloads = [
      { $gt: "" },
      { $gte: "" },
      { $ne: "not-the-password" },
      { $regex: ".*" },
      { $nin: ["not-the-password"] },
      { $exists: true }
    ];

    assert.equal(normal?.username, username);

    const unprefixedAssignmentShape = await collection.findOne({
      username,
      password: { gt: "" }
    });

    assert.equal(unprefixedAssignmentShape, null);

    for (const passwordQuery of operatorPayloads) {
      const operatorMatch = await collection.findOne({
        username,
        password: passwordQuery
      });

      assert.equal(operatorMatch?.username, username);
    }
  } finally {
    await collection.deleteMany({ username });
    await dbClient.close();
  }
});
