import { Router } from "express";
import { observeLabLogin } from "./auth.service.js";
import { validateLabLoginBody } from "./validation.js";
import { errorResponse } from "../../shared/errors.js";

export function createLabAuthRouter({ dbClient }) {
  const router = Router();

  router.post("/login-observation", async (request, response, next) => {
    try {
      const input = validateLabLoginBody(request.body);
      const result = await observeLabLogin(dbClient.db(), input);

      if (!result.authenticated) {
        response.status(401).json({
          ...errorResponse("INVALID_CREDENTIALS", "Lab login did not authenticate"),
          mode: "lab",
          inputType: result.inputType,
          payloadVariant: result.payloadVariant
        });
        return;
      }

      response.status(200).json({
        ok: true,
        authenticated: true,
        mode: "lab",
        inputType: result.inputType,
        payloadVariant: result.payloadVariant,
        user: result.user,
        note: "Controlled local lab result; do not reuse this route in production"
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
