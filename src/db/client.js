import { MongoClient } from "mongodb";

export function createDatabaseClient({
  mongoUri,
  mongoDatabase,
  serverSelectionTimeoutMS = 3000
}) {
  let client;
  let database;

  return {
    async connect() {
      if (database) {
        return database;
      }

      client = new MongoClient(mongoUri, {
        serverSelectionTimeoutMS
      });

      await client.connect();
      database = client.db(mongoDatabase);
      return database;
    },

    db() {
      if (!database) {
        throw new Error("Database client is not connected");
      }

      return database;
    },

    async ping() {
      if (!database) {
        return false;
      }

      try {
        await database.command({ ping: 1 });
        return true;
      } catch {
        return false;
      }
    },

    async close() {
      if (client) {
        await client.close();
      }

      client = undefined;
      database = undefined;
    }
  };
}
