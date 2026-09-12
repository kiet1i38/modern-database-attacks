import { COLLECTIONS } from "./collections.js";

export async function ensureIndexes(database) {
  await database.collection(COLLECTIONS.USERS).createIndex(
    { username: 1 },
    { unique: true, name: "users_username_unique" }
  );

  await database.collection(COLLECTIONS.LAB_USERS).createIndex(
    { username: 1 },
    { unique: true, name: "lab_users_username_unique" }
  );
}
