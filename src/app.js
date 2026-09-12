import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHealthRouter } from "./modules/health/health.routes.js";
import { createSecureAuthRouter } from "./modules/auth/secure.routes.js";
import { createLabAuthRouter } from "./modules/auth/lab.routes.js";
import { createLabGuard } from "./middleware/lab-guard.js";
import { errorHandler, errorResponse } from "./shared/errors.js";

const PUBLIC_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), "public");

export function createApp({ config, dbClient }) {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({
    limit: config.jsonBodyLimit,
    strict: true
  }));

  app.use(express.static(PUBLIC_DIRECTORY));

  app.use("/api/health", createHealthRouter({
    serviceName: config.serviceName,
    dbClient
  }));

  app.use("/api/auth", createSecureAuthRouter({ dbClient }));

  app.get("/api/lab/status", (request, response) => {
    const enabled = config.labMode && config.nodeEnv !== "production";

    response.status(200).json({
      ok: true,
      enabled,
      mode: enabled ? "lab" : "secure-only"
    });
  });

  app.use(
    "/api/lab",
    createLabGuard(config),
    createLabAuthRouter({ dbClient })
  );

  app.use("/api", (request, response) => {
    response.status(404).json(errorResponse("NOT_FOUND", "Route not found"));
  });

  app.use((request, response) => {
    response.status(404).json(errorResponse("NOT_FOUND", "Route not found"));
  });

  app.use(errorHandler);

  return app;
}
