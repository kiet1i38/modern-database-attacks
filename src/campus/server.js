import { createRepository } from "./repository.js";
import { createCampusApp } from "./app.js";
const variant = process.env.VARIANT || "mongo-safe";
if (process.env.NODE_ENV === "production" || process.env.LAB_LOCAL_ONLY !== "true") {
  throw new Error("CampusDesk is a synthetic localhost teaching lab. Set LAB_LOCAL_ONLY=true and never deploy it to production.");
}
const repo = await createRepository(variant);
await repo.setup();
const app = createCampusApp({ repo, variant, secret: process.env.SESSION_SECRET, sessionMaxAge: Number(process.env.SESSION_MAX_AGE_MS || 1800000) });
const server = app.listen(Number(process.env.PORT || 3000), process.env.HOST || "127.0.0.1", () => {
  console.log(JSON.stringify({ service: "CampusDesk", variant, database: repo.databaseName, status: "ready" }));
});
for (const signal of ["SIGTERM", "SIGINT"]) process.once(signal, () => server.close(async () => { await repo.close(); process.exit(0); }));
