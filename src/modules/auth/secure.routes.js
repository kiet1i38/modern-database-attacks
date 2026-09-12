import { Router } from "express";
import { authenticateSecure } from "./auth.service.js";
import { validateSecureLoginBody } from "./validation.js";
import { errorResponse } from "../../shared/errors.js";

export function createSecureAuthRouter({ dbClient }) {
  const router = Router();

  router.post("/login", async (request, response, next) => {
    try {
      const input = validateSecureLoginBody(request.body);
      const result = await authenticateSecure(dbClient.db(), input);

      if (!result.authenticated) {
        response.status(401).json(errorResponse(
          "INVALID_CREDENTIALS",
          "Invalid credentials"
        ));
        return;
      }

      response.status(200).json({
        ok: true,
        user: result.user
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/logout", (request, response) => {
    response.status(200).json({ ok: true });
  });

  return router;
}
