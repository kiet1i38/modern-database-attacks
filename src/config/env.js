const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();

  if (TRUE_VALUES.has(normalized)) {
    return true;
  }

  if (FALSE_VALUES.has(normalized)) {
    return false;
  }

  throw new Error("Invalid boolean environment value");
}

function parsePort(value) {
  const port = Number(value ?? 3000);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  return port;
}

function assertDatabaseName(name) {
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    throw new Error("MongoDB database names may contain only letters, numbers, underscores and hyphens");
  }
}

export function loadConfig(environment = process.env) {
  const nodeEnv = environment.NODE_ENV ?? "development";
  const database = environment.MONGODB_DATABASE ?? "modern_database_attacks";
  const testDatabase = environment.MONGODB_TEST_DATABASE ?? "modern_database_attacks_test";

  assertDatabaseName(database);
  assertDatabaseName(testDatabase);

  return {
    nodeEnv,
    host: environment.HOST ?? "127.0.0.1",
    port: parsePort(environment.PORT),
    mongoUri: environment.MONGODB_URI ?? "mongodb://localhost:27017",
    mongoDatabase: database,
    mongoTestDatabase: testDatabase,
    labMode: parseBoolean(environment.LAB_MODE, false),
    jsonBodyLimit: environment.JSON_BODY_LIMIT ?? "16kb",
    demoUsername: environment.DEMO_USERNAME ?? "alice",
    secureDemoPassword: environment.SECURE_DEMO_PASSWORD ?? "synthetic-demo-password",
    labDemoPassword: environment.LAB_DEMO_PASSWORD ?? "lab-only-demo-password",
    serviceName: "modern-database-attacks"
  };
}

export const config = loadConfig();
