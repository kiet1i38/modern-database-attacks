export class AppError extends Error {
  constructor(message, { statusCode = 500, code = "INTERNAL_ERROR" } = {}) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function errorResponse(code, message) {
  return {
    ok: false,
    error: {
      code,
      message
    }
  };
}

export function errorHandler(error, request, response, next) {
  if (response.headersSent) {
    next(error);
    return;
  }

  if (error instanceof SyntaxError && "body" in error) {
    response.status(400).json(errorResponse("INVALID_JSON", "Request body must be valid JSON"));
    return;
  }

  const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
  const code = error.code ?? "INTERNAL_ERROR";
  const message = statusCode >= 500 ? "Internal server error" : error.message;

  console.error("[" + request.method + " " + request.originalUrl + "] " + error.message);
  response.status(statusCode).json(errorResponse(code, message));
}
