const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function normalizeAddress(address = "") {
  return address.replace(/^::ffff:/, "").replaceAll("[", "").replaceAll("]", "");
}

function isLoopbackRequest(request) {
  const hostname = normalizeAddress(request.hostname ?? "").toLowerCase();
  const remoteAddress = normalizeAddress(request.socket?.remoteAddress ?? "");

  return LOOPBACK_HOSTS.has(hostname)
    || LOOPBACK_HOSTS.has(remoteAddress)
    || hostname === "::1";
}

export function createLabGuard(config) {
  return function labGuard(request, response, next) {
    if (!config.labMode) {
      response.status(404).json({
        ok: false,
        error: {
          code: "LAB_DISABLED",
          message: "The local lab route is disabled"
        }
      });
      return;
    }

    if (config.nodeEnv === "production") {
      response.status(404).json({
        ok: false,
        error: {
          code: "LAB_UNAVAILABLE",
          message: "The local lab route is unavailable in production mode"
        }
      });
      return;
    }

    if (!isLoopbackRequest(request)) {
      response.status(403).json({
        ok: false,
        error: {
          code: "LAB_LOCAL_ONLY",
          message: "The local lab route accepts loopback requests only"
        }
      });
      return;
    }

    next();
  };
}

export { isLoopbackRequest };
