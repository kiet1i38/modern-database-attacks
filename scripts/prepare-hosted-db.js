import { loadHostedConfig } from "../src/campus/hosted.js";
import { createRepository } from "../src/campus/repository.js";

const { variant } = loadHostedConfig();
const repo = await createRepository(variant);
try {
  await repo.setup();
  console.log(JSON.stringify({ variant, database: repo.databaseName, operation: "prepare-and-seed-if-empty", ok: true }));
} finally {
  await repo.close();
}
