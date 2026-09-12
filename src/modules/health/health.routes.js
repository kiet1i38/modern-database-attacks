import { Router } from "express";

export function createHealthRouter({ serviceName, dbClient }) {
  const router = Router();

  router.get("/", async (request, response) => {
    const databaseUp = await dbClient.ping();

    response.status(databaseUp ? 200 : 503).json({
      ok: databaseUp,
      service: serviceName,
      database: databaseUp ? "up" : "down"
    });
  });

  return router;
}
