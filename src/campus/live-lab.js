import mysql from "mysql2/promise";
import { MongoClient } from "mongodb";

const SQL_LAB_DATABASE = "campus_sql_unsafe_lab";
const MONGO_LAB_DATABASE = "campus_mongo_unsafe_lab";
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "mysql", "mongodb"]);
const SQL_USERS = [{ id: "lab-admin", username: "labadmin", password: "Lab@123", role: "admin" }];
const SQL_EVENTS = [
  { id: "event-1", owner: "alice", note: "synthetic login event A" },
  { id: "event-2", owner: "bob", note: "synthetic login event B" },
  { id: "event-3", owner: "charlie", note: "synthetic login event C" }
];
const MONGO_USERS = [{ _id: "lab-admin", username: "labadmin", password: "Lab@123", role: "admin" }];
const MONGO_NOTES = [
  { _id: "note-1", id: "note-1", owner: "alice", body: "synthetic A" },
  { _id: "note-2", id: "note-2", owner: "bob", body: "synthetic B" },
  { _id: "note-3", id: "note-3", owner: "charlie", body: "synthetic C" }
];

function localOnly(env) { return env.CAMPUS_HOSTED_DEMO !== "true"; }

function mysqlLabOptions(env) {
  const raw = env.CAMPUS_SQL_LAB_URL;
  if (!raw) throw new Error("CAMPUS_SQL_LAB_URL is required for the SQL live lab.");
  const url = new URL(raw);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (url.protocol !== "mysql:" || database !== SQL_LAB_DATABASE || !url.username || !url.password) {
    throw new Error("SQL live lab URL must use mysql:// credentials and the isolated campus_sql_unsafe_lab database.");
  }
  if (localOnly(env) && !LOCAL_HOSTS.has(url.hostname)) {
    throw new Error("Local SQL live lab must use a local or Docker-network MySQL host.");
  }
  if (!localOnly(env) && LOCAL_HOSTS.has(url.hostname)) {
    throw new Error("Hosted SQL live lab must use its dedicated remote sandbox database.");
  }
  if (["false", "0", "off"].includes((url.searchParams.get("ssl") || "").toLowerCase())) {
    throw new Error("SQL live lab TLS cannot be disabled.");
  }
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    connectionLimit: 2,
    connectTimeout: 7000,
    multipleStatements: true,
    ...(!localOnly(env) ? { ssl: { rejectUnauthorized: true, ...(env.CAMPUS_SQL_LAB_SSL_CA ? { ca: env.CAMPUS_SQL_LAB_SSL_CA } : {}) } } : {})
  };
}

function mongoLabUri(env) {
  const raw = env.CAMPUS_MONGO_LAB_URI;
  if (!raw) throw new Error("CAMPUS_MONGO_LAB_URI is required for the MongoDB live lab.");
  const url = new URL(raw);
  const database = decodeURIComponent(url.pathname.replace(/^\//, "").split("/")[0]);
  if (!["mongodb:", "mongodb+srv:"].includes(url.protocol) || database !== MONGO_LAB_DATABASE) {
    throw new Error("Mongo live lab URI must select the isolated campus_mongo_unsafe_lab database.");
  }
  if (localOnly(env) && !LOCAL_HOSTS.has(url.hostname)) {
    throw new Error("Local Mongo live lab must use a local or Docker-network MongoDB host.");
  }
  if (!localOnly(env) && (url.protocol !== "mongodb+srv:" || LOCAL_HOSTS.has(url.hostname) || !url.username || !url.password)) {
    throw new Error("Hosted Mongo live lab requires a credentialed TLS-enabled Atlas sandbox URI.");
  }
  if (["false", "0", "off"].includes((url.searchParams.get("tls") || "").toLowerCase())) {
    throw new Error("Mongo live lab TLS cannot be disabled.");
  }
  return raw;
}

export function validateLiveLabConfig(variant, env = process.env) {
  const sqlEnabled = env.CAMPUS_SQL_STACKED_LAB === "true";
  const mongoEnabled = env.CAMPUS_MONGO_DELETE_LAB === "true";
  if (sqlEnabled) {
    if (variant !== "sql-unsafe") throw new Error("The SQL stacked lab is restricted to sql-unsafe.");
    mysqlLabOptions(env);
  }
  if (mongoEnabled) {
    if (variant !== "mongo-unsafe") throw new Error("The Mongo delete lab is restricted to mongo-unsafe.");
    mongoLabUri(env);
  }
  return { sqlEnabled, mongoEnabled };
}

function sqlSchema() {
  return [
    "CREATE TABLE IF NOT EXISTS lab_control (id VARCHAR(32) PRIMARY KEY)",
    "CREATE TABLE IF NOT EXISTS lab_users (id VARCHAR(36) PRIMARY KEY, username VARCHAR(120) NOT NULL UNIQUE, password VARCHAR(120) NOT NULL, role VARCHAR(24) NOT NULL)",
    "CREATE TABLE IF NOT EXISTS lab_events (id VARCHAR(36) PRIMARY KEY, owner VARCHAR(40) NOT NULL, note VARCHAR(120) NOT NULL)"
  ];
}

async function seedSql(pool) {
  for (const statement of sqlSchema()) await pool.query(statement);
  for (const user of SQL_USERS) {
    await pool.execute("INSERT INTO lab_users (id,username,password,role) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE username=VALUES(username),password=VALUES(password),role=VALUES(role)",
      [user.id, user.username, user.password, user.role]);
  }
  for (const event of SQL_EVENTS) {
    await pool.execute("INSERT INTO lab_events (id,owner,note) VALUES (?,?,?) ON DUPLICATE KEY UPDATE owner=VALUES(owner),note=VALUES(note)",
      [event.id, event.owner, event.note]);
  }
  await pool.execute("INSERT INTO lab_control (id) VALUES ('seed-v1') ON DUPLICATE KEY UPDATE id=VALUES(id)");
}

function rowsFromQueryResult(result) {
  return Array.isArray(result?.[0]) ? result[0] : result;
}

export async function createLiveLabRepository(variant, env = process.env) {
  const { sqlEnabled, mongoEnabled } = validateLiveLabConfig(variant, env);

  if (variant === "sql-unsafe" && sqlEnabled) {
    const pool = mysql.createPool(mysqlLabOptions(env));
    let seedPromise;
    async function ensureSeeded() {
      if (!seedPromise) {
        seedPromise = (async () => {
          const [marker] = await pool.query("SHOW TABLES LIKE 'lab_control'");
          if (!marker.length) await seedSql(pool);
        })();
      }
      try { await seedPromise; }
      catch (error) { seedPromise = undefined; throw error; }
    }
    async function state() {
      await ensureSeeded();
      const [tables] = await pool.query("SHOW TABLES LIKE 'lab_events'");
      if (!tables.length) return { kind: "sql", database: SQL_LAB_DATABASE, eventsTableExists: false, events: [] };
      const [events] = await pool.query("SELECT id, owner, note FROM lab_events ORDER BY id");
      return { kind: "sql", database: SQL_LAB_DATABASE, eventsTableExists: true, events };
    }
    return {
      enabled: true,
      kind: "sql",
      async initialize() { await ensureSeeded(); },
      async state() { return state(); },
      async login(mode, username, password) {
        await ensureSeeded();
        if (typeof username !== "string" || typeof password !== "string" || !username.length) {
          return { matched: false, blocked: true, query: "" };
        }
        if (mode === "safe") {
          const query = "SELECT id, username, role FROM lab_users WHERE username = ? AND password = ?";
          const [rows] = await pool.execute(query, [username, password]);
          const user = rows[0] ? { id: rows[0].id, username: rows[0].username, role: rows[0].role } : null;
          return { mode, matched: Boolean(user), user, query };
        }
        if (mode !== "unsafe") return { matched: false, blocked: true, query: "" };
        const query = "SELECT id, username, role FROM lab_users WHERE username = '" + username + "' AND password = '" + password + "'";
        const [result] = await pool.query(query);
        const rows = rowsFromQueryResult(result);
        const user = rows[0] ? { id: rows[0].id, username: rows[0].username, role: rows[0].role } : null;
        return { mode, matched: Boolean(user), user, query };
      },
      async reset() {
        for (const statement of sqlSchema()) await pool.query(statement);
        await pool.query("DELETE FROM lab_users");
        await pool.query("DELETE FROM lab_events");
        for (const user of SQL_USERS) {
          await pool.execute("INSERT INTO lab_users (id,username,password,role) VALUES (?,?,?,?)", [user.id, user.username, user.password, user.role]);
        }
        for (const event of SQL_EVENTS) {
          await pool.execute("INSERT INTO lab_events (id,owner,note) VALUES (?,?,?)", [event.id, event.owner, event.note]);
        }
        await pool.execute("INSERT INTO lab_control (id) VALUES ('seed-v1') ON DUPLICATE KEY UPDATE id=VALUES(id)");
        return state();
      },
      async close() { await pool.end(); }
    };
  }

  if (variant === "mongo-unsafe" && mongoEnabled) {
    const uri = mongoLabUri(env);
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
      ...(localOnly(env) ? {} : { tls: true, tlsAllowInvalidCertificates: false, tlsAllowInvalidHostnames: false })
    });
    try { await client.connect(); }
    catch (error) { await client.close(); throw error; }
    const db = client.db(MONGO_LAB_DATABASE);
    const users = db.collection("lab_users"), notes = db.collection("lab_notes"), control = db.collection("lab_control");
    let seedPromise;
    async function ensureSeeded() {
      if (!seedPromise) {
        seedPromise = (async () => {
          if (await control.findOne({ _id: "seed-v1" })) return;
          for (const user of MONGO_USERS) await users.updateOne({ _id: user._id }, { $setOnInsert: user }, { upsert: true });
          for (const note of MONGO_NOTES) await notes.updateOne({ _id: note._id }, { $setOnInsert: note }, { upsert: true });
          await control.updateOne({ _id: "seed-v1" }, { $setOnInsert: { initializedAt: new Date() } }, { upsert: true });
        })();
      }
      try { await seedPromise; }
      catch (error) { seedPromise = undefined; throw error; }
    }
    async function state() {
      await ensureSeeded();
      const records = await notes.find({}, { projection: { _id: 0 } }).sort({ id: 1 }).toArray();
      return { kind: "mongo", database: MONGO_LAB_DATABASE, collection: "lab_notes", notes: records };
    }
    return {
      enabled: true,
      kind: "mongo",
      async initialize() { await ensureSeeded(); },
      async state() { return state(); },
      async login(mode, username, password) {
        await ensureSeeded();
        if (typeof username !== "string" || !username.length || Array.isArray(password) || password === null || (typeof password !== "string" && typeof password !== "object")) {
          return { mode, matched: false, blocked: true, user: null, query: "" };
        }
        if (mode === "safe" && typeof password !== "string") {
          return { mode, matched: false, blocked: true, user: null, query: "findOne({ username, password }) with string validation" };
        }
        if (mode !== "safe" && mode !== "unsafe") return { mode, matched: false, blocked: true, user: null, query: "" };
        const query = mode === "unsafe" ? "findOne({ username, password })" : "findOne({ username, password }) with string validation";
        const row = await users.findOne({ username, password });
        return { mode, matched: Boolean(row), user: row ? { username: row.username, role: row.role } : null, query };
      },
      async deleteOwner(mode, owner) {
        await ensureSeeded();
        if (mode === "safe") {
          if (typeof owner !== "string") return { mode, blocked: true, deletedCount: 0 };
          const result = await notes.deleteMany({ owner: { $eq: owner } });
          return { mode, blocked: false, deletedCount: result.deletedCount };
        }
        if (mode !== "unsafe" || owner === null || Array.isArray(owner) || (typeof owner !== "string" && typeof owner !== "object")) {
          return { mode, blocked: true, deletedCount: 0 };
        }
        const result = await notes.deleteMany({ owner });
        return { mode, blocked: false, deletedCount: result.deletedCount };
      },
      async reset() {
        await ensureSeeded();
        await notes.deleteMany({});
        for (const note of MONGO_NOTES) await notes.updateOne({ _id: note._id }, { $setOnInsert: note }, { upsert: true });
        await users.deleteMany({});
        for (const user of MONGO_USERS) await users.updateOne({ _id: user._id }, { $setOnInsert: user }, { upsert: true });
        return state();
      },
      async close() { await client.close(); }
    };
  }

  return null;
}
