import { VARIANTS } from "./domain.js";
import { createCampusApp } from "./app.js";
import { createRepository } from "./repository.js";

export function loadHostedConfig(env = process.env) {
  if (env.CAMPUS_HOSTED_DEMO !== "true") throw new Error("Set CAMPUS_HOSTED_DEMO=true for a synthetic hosted demo.");
  if (env.VERCEL_ENV === "production" && env.CAMPUS_ALLOW_PRODUCTION_DEMO !== "true") {
    throw new Error("Set CAMPUS_ALLOW_PRODUCTION_DEMO=true for this explicitly approved synthetic production demo.");
  }
  const variant = env.VARIANT;
  if (!Object.hasOwn(VARIANTS, variant) || (!VARIANTS[variant].safe && env.CAMPUS_ALLOW_UNSAFE_DEMO !== "true")) {
    throw new Error("Only safe hosted variants are enabled unless CAMPUS_ALLOW_UNSAFE_DEMO=true.");
  }
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters.");
  const sessionMaxAge = Number(env.SESSION_MAX_AGE_MS || 1800000);
  if (!Number.isSafeInteger(sessionMaxAge) || sessionMaxAge <= 0) throw new Error("SESSION_MAX_AGE_MS must be a positive integer.");
  if (variant.startsWith("sql")) {
    if (!env.MYSQL_HOST || !env.MYSQL_USER || !env.MYSQL_PASSWORD || env.MYSQL_SSL !== "true") {
      throw new Error("Hosted SQL requires MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD and MYSQL_SSL=true.");
    }
    const port = Number(env.MYSQL_PORT || 3306);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("MYSQL_PORT must be a valid TCP port.");
  } else if (!env.MONGODB_URI?.startsWith("mongodb+srv://")) {
    throw new Error("Hosted MongoDB requires a TLS-enabled mongodb+srv:// MONGODB_URI.");
  }
  const variantUrls = {};
  for (const id of Object.keys(VARIANTS)) {
    const value = env["CAMPUS_" + id.replaceAll("-", "_").toUpperCase() + "_URL"];
    if (!value) continue;
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      throw new Error("Variant URLs must be HTTPS origins without credentials, paths or query strings.");
    }
    variantUrls[id] = url.origin;
  }
  return { variant, secret: env.SESSION_SECRET, sessionMaxAge, hosted: true, variantUrls };
}

export function createHostedHandler({ env = process.env, connect = createRepository } = {}) {
  let application;
  return async (req, res) => {
    try {
      application ||= (async () => {
        const config = loadHostedConfig(env);
        const repo = await connect(config.variant, env);
        return createCampusApp({ repo, ...config });
      })();
      const app = await application;
      app(req, res);
    } catch {
      application = undefined;
      res.statusCode = 503;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.end(JSON.stringify({ ok: false, code: "SERVICE_UNAVAILABLE", message: "Hosted demo chưa sẵn sàng. Kiểm tra cấu hình và kết nối database." }));
    }
  };
}
