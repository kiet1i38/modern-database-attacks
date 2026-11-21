import mysql from "mysql2/promise";
import { MongoClient } from "mongodb";
import { seedData, VARIANTS } from "./domain.js";

export async function createRepository(variant, env = process.env) {
  if (!VARIANTS[variant]) throw new Error("VARIANT phải là sql-safe/sql-unsafe/mongo-safe/mongo-unsafe.");
  const databaseName = env.CAMPUS_DATABASE || "campus_" + variant.replaceAll("-", "_");

  if (variant.startsWith("sql")) {
    const host = env.MYSQL_HOST || "127.0.0.1";
    const pool = mysql.createPool({
      host, port: Number(env.MYSQL_PORT || 3306),
      user: env.MYSQL_USER || "campus", password: env.MYSQL_PASSWORD || "campus-local-demo-only",
      database: databaseName, connectionLimit: 8, connectTimeout: 5000,
      multipleStatements: false,
      ...(env.MYSQL_SSL === "true" ? { ssl: { rejectUnauthorized: true, ...(env.MYSQL_SSL_CA ? { ca: env.MYSQL_SSL_CA } : {}) } } : {})
    });
    const query = async (sql, params = []) => (await pool.execute(sql, params))[0];
    const normalize = row => row ? { ...row, active: Boolean(row.active), createdAt: Number(row.createdAt), updatedAt: Number(row.updatedAt) } : null;
    const repository = {
      databaseName,
      async setup() {
        await query("CREATE TABLE IF NOT EXISTS users (id VARCHAR(36) PRIMARY KEY, username VARCHAR(120) UNIQUE NOT NULL, name VARCHAR(120) NOT NULL, role ENUM('admin','user') NOT NULL, email VARCHAR(160), department VARCHAR(120), active BOOLEAN NOT NULL, password VARCHAR(256), passwordHash VARCHAR(256))");
        await query("CREATE TABLE IF NOT EXISTS tickets (id VARCHAR(36) PRIMARY KEY, code VARCHAR(24) UNIQUE, ownerId VARCHAR(36) NOT NULL, title VARCHAR(160), description TEXT, category VARCHAR(24), priority VARCHAR(24), status VARCHAR(24), createdAt BIGINT, updatedAt BIGINT, FOREIGN KEY(ownerId) REFERENCES users(id))");
        await query("CREATE TABLE IF NOT EXISTS sessions (sid VARCHAR(128) PRIMARY KEY, data JSON NOT NULL, expires BIGINT NOT NULL)");
        await query("CREATE TABLE IF NOT EXISTS audit (id VARCHAR(36) PRIMARY KEY, actor VARCHAR(120), action VARCHAR(60), result VARCHAR(20), payload VARCHAR(24), createdAt BIGINT)");
        await this.seed();
      },
      async seed(reset = false) {
        if (reset) {
          for (const table of ["sessions", "audit", "tickets", "users"]) await query("DELETE FROM " + table);
        }
        if (Number((await query("SELECT COUNT(*) AS n FROM users"))[0].n)) return;
        const data = seedData(VARIANTS[variant].safe);
        for (const user of data.users) await this.createUser(user);
        for (const ticket of data.tickets) await this.createTicket(ticket);
      },
      async resetDemoSeed() {
        const data = seedData(VARIANTS[variant].safe);
        for (const user of data.users) {
          await query("INSERT INTO users (id,username,name,role,email,department,active,password,passwordHash) VALUES (?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE username=VALUES(username),name=VALUES(name),role=VALUES(role),email=VALUES(email),department=VALUES(department),active=VALUES(active),password=VALUES(password),passwordHash=VALUES(passwordHash)",
            [user.id,user.username,user.name,user.role,user.email,user.department,user.active,user.password,user.passwordHash]);
        }
        for (const ticket of data.tickets) {
          await query("INSERT INTO tickets (id,code,ownerId,title,description,category,priority,status,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE code=VALUES(code),ownerId=VALUES(ownerId),title=VALUES(title),description=VALUES(description),category=VALUES(category),priority=VALUES(priority),status=VALUES(status),createdAt=VALUES(createdAt),updatedAt=VALUES(updatedAt)",
            [ticket.id,ticket.code,ticket.ownerId,ticket.title,ticket.description,ticket.category,ticket.priority,ticket.status,ticket.createdAt,ticket.updatedAt]);
        }
        return { usersRestored: data.users.length, ticketsRestored: data.tickets.length };
      },
      async userByUsername(username) { return normalize((await query("SELECT * FROM users WHERE username = ?", [username]))[0]); },
      async userById(id) { return normalize((await query("SELECT * FROM users WHERE id = ?", [id]))[0]); },
      async unsafeLogin(username, password) {
        // INTENTIONALLY VULNERABLE: only this login query interpolates input.
        // Keep stacked statements disabled on the CampusDesk database.
        const [rows] = await pool.query("SELECT * FROM users WHERE username = '" + username + "' AND password = '" + password +
          "'\nORDER BY role ASC, username ASC LIMIT 1");
        return normalize(rows[0]);
      },
      async users() { return (await query("SELECT * FROM users ORDER BY role, username")).map(normalize); },
      async createUser(user) {
        await query("INSERT INTO users (id,username,name,role,email,department,active,password,passwordHash) VALUES (?,?,?,?,?,?,?,?,?)",
          [user.id,user.username,user.name,user.role,user.email,user.department,user.active,user.password,user.passwordHash]);
      },
      async updateUser(id, changes) {
        const allowed = ["name", "email", "department", "active"];
        const keys = allowed.filter(key => Object.hasOwn(changes, key));
        if (keys.length) await query("UPDATE users SET " + keys.map(key => key + " = ?").join(", ") + " WHERE id = ?", [...keys.map(key => changes[key]), id]);
        return this.userById(id);
      },
      async tickets(ownerId) {
        return (await query("SELECT * FROM tickets" + (ownerId ? " WHERE ownerId = ?" : "") + " ORDER BY createdAt DESC", ownerId ? [ownerId] : [])).map(normalize);
      },
      async ticketById(id) { return normalize((await query("SELECT * FROM tickets WHERE id = ?", [id]))[0]); },
      async createTicket(ticket) {
        await query("INSERT INTO tickets (id,code,ownerId,title,description,category,priority,status,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)",
          [ticket.id,ticket.code,ticket.ownerId,ticket.title,ticket.description,ticket.category,ticket.priority,ticket.status,ticket.createdAt,ticket.updatedAt]);
      },
      async updateTicket(id, changes) {
        await query("UPDATE tickets SET status = ?, priority = ?, updatedAt = ? WHERE id = ?", [changes.status, changes.priority, Date.now(), id]);
        return this.ticketById(id);
      },
      async audit(event) { await query("INSERT INTO audit (id,actor,action,result,payload,createdAt) VALUES (?,?,?,?,?,?)", [event.id,event.actor,event.action,event.result,event.payload,event.createdAt]); },
      async events() { return await query("SELECT * FROM audit ORDER BY createdAt DESC LIMIT 20"); },
      async getSession(sid) {
        const row = (await query("SELECT data FROM sessions WHERE sid = ? AND expires > ?", [sid, Date.now()]))[0];
        return row ? (typeof row.data === "string" ? JSON.parse(row.data) : row.data) : null;
      },
      async setSession(sid, data) {
        const expires = new Date(data.cookie.expires).getTime();
        await query("INSERT INTO sessions (sid,data,expires) VALUES (?,?,?) ON DUPLICATE KEY UPDATE data = VALUES(data), expires = VALUES(expires)", [sid, JSON.stringify(data), expires]);
        await query("DELETE FROM sessions WHERE expires < ?", [Date.now()]);
      },
      async deleteSession(sid) { await query("DELETE FROM sessions WHERE sid = ?", [sid]); },
      async ping() { await query("SELECT 1"); },
      async close() { await pool.end(); }
    };
    return repository;
  }
  const mongoUri = env.MONGODB_URI || "mongodb://127.0.0.1:27017";
  const client = new MongoClient(mongoUri, {
    serverSelectionTimeoutMS: 3000,
    ...(env.CAMPUS_HOSTED_DEMO === "true" ? { tls: true, tlsAllowInvalidCertificates: false, tlsAllowInvalidHostnames: false } : {})
  });
  try { await client.connect(); }
  catch (error) { await client.close(); throw error; }
  const db = client.db(databaseName);
  const users = db.collection("users"), tickets = db.collection("tickets"), sessions = db.collection("sessions"), audit = db.collection("audit");
  const strip = row => { if (!row) return null; const { _id, ...rest } = row; return rest; };
  return {
    databaseName,
    async setup() {
      await users.createIndex({ username: 1 }, { unique: true });
      await users.createIndex({ id: 1 }, { unique: true });
      await tickets.createIndex({ id: 1 }, { unique: true });
      await tickets.createIndex({ ownerId: 1, createdAt: -1 });
      await sessions.createIndex({ expires: 1 }, { expireAfterSeconds: 0 });
      await this.seed();
    },
    async seed(reset = false) {
      if (reset) for (const collection of [sessions, audit, tickets, users]) await collection.deleteMany({});
      if (await users.countDocuments()) return;
      const data = seedData(VARIANTS[variant].safe);
      await users.insertMany(data.users);
      await tickets.insertMany(data.tickets);
    },
    async resetDemoSeed() {
      const data = seedData(VARIANTS[variant].safe);
      for (const user of data.users) await users.updateOne({ id: user.id }, { $set: user }, { upsert: true });
      for (const ticket of data.tickets) await tickets.updateOne({ id: ticket.id }, { $set: ticket }, { upsert: true });
      return { usersRestored: data.users.length, ticketsRestored: data.tickets.length };
    },
    async userByUsername(username) { return strip(await users.findOne({ username })); },
    async userById(id) { return strip(await users.findOne({ id })); },
    async unsafeLogin(username, password) {
      // INTENTIONALLY VULNERABLE: password object changes MongoDB query predicates.
      return strip(await users.findOne({ username, password }));
    },
    async users() { return (await users.find({}, { projection: { _id: 0 } }).sort({ role: 1, username: 1 }).toArray()); },
    async createUser(user) { await users.insertOne({ ...user }); },
    async updateUser(id, changes) { await users.updateOne({ id }, { $set: changes }); return this.userById(id); },
    async tickets(ownerId) { return tickets.find(ownerId ? { ownerId } : {}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray(); },
    async ticketById(id) { return strip(await tickets.findOne({ id })); },
    async createTicket(ticket) { await tickets.insertOne({ ...ticket }); },
    async updateTicket(id, changes) { await tickets.updateOne({ id }, { $set: { ...changes, updatedAt: Date.now() } }); return this.ticketById(id); },
    async audit(event) { await audit.insertOne({ ...event }); },
    async events() { return audit.find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).limit(20).toArray(); },
    async getSession(sid) { return (await sessions.findOne({ _id: sid, expires: { $gt: new Date() } }))?.data || null; },
    async setSession(sid, data) { await sessions.updateOne({ _id: sid }, { $set: { data, expires: new Date(data.cookie.expires) } }, { upsert: true }); },
    async deleteSession(sid) { await sessions.deleteOne({ _id: sid }); },
    async ping() { await db.command({ ping: 1 }); },
    async close() { await client.close(); }
  };
}
