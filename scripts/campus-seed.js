import { createRepository } from "../src/campus/repository.js";
const variant = process.env.VARIANT;
if (!variant || process.env.LAB_LOCAL_ONLY !== "true") throw new Error("Run inside a configured CampusDesk app container.");
const reset = process.argv.includes("--reset");
if (reset && !process.argv.includes("--yes")) throw new Error("Reset deletes this variant's synthetic data. Pass --yes to confirm.");
const repo = await createRepository(variant);
try { await repo.setup(); if (reset) await repo.seed(true); console.log(JSON.stringify({ variant, database: repo.databaseName, operation: reset ? "reset-and-seed" : "seed-if-empty", ok: true })); }
finally { await repo.close(); }
