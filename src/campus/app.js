import express from "express";
import session from "express-session";
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import path from "node:path";
import { VARIANTS, SQL_PAYLOADS, MONGO_PAYLOADS, STATUSES, PRIORITIES, publicUser, loginInput, diagnostic, verifyPassword, hashPassword, textField, ticketInput, makeTicket, fail } from "./domain.js";
import { resolveLocale } from "./i18n/locale.js";
import { translateApiMessage } from "./i18n/messages.js";

const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const token = () => randomBytes(24).toString("hex");
function localizeDiagnostic(detail, locale) {
  if (!detail) return null;
  return { ...detail, explanation: detail.explanationKey ? translateApiMessage(detail.explanationKey, locale) : detail.explanation };
}
function sameToken(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
class DatabaseStore extends session.Store {
  constructor(repo) { super(); this.repo = repo; }
  get(sid, callback) { this.repo.getSession(sid).then(data => callback(null, data)).catch(callback); }
  set(sid, data, callback) { this.repo.setSession(sid, data).then(() => callback?.()).catch(callback); }
  destroy(sid, callback) { this.repo.deleteSession(sid).then(() => callback?.()).catch(callback); }
  touch(sid, data, callback) { this.set(sid, data, callback); }
}
export function createCampusApp({ repo, lab = null, variant, secret, sessionMaxAge = 1800000, hosted = false, variantUrls = {} }) {
  if (!VARIANTS[variant] || !secret || secret.length < 32) throw new Error("Invalid variant/session configuration.");
  const app = express();
  if (hosted) app.set("trust proxy", 1);
  const definition = VARIANTS[variant];
  const cookieName = "campus_" + variant.replaceAll("-", "_");
  // shortcut: this limit is per process; use a shared edge limit before hosting beyond a small demo.
  const attempts = new Map();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'"
    });
    if (req.path.startsWith("/api/")) res.set("Cache-Control", "no-store");
    next();
  });
  app.use("/api", (req, res, next) => {
    req.locale = resolveLocale(req.get("accept-language"));
    res.set("Content-Language", req.locale);
    res.vary("Accept-Language");
    next();
  });
  app.get("/api/health", asyncRoute(async (req, res) => {
    try { await repo.ping(); res.json({ ok: true, variant, database: definition.database, status: "ready" }); }
    catch { res.status(503).json({ ok: false, variant, database: definition.database, status: "unavailable" }); }
  }));
  app.get("/api/config", (req, res) => res.json({
    variant, ...definition, variants: Object.fromEntries(Object.entries(VARIANTS).map(([id, value]) => [id, { ...value, ...(variantUrls[id] ? { url: variantUrls[id] } : {}) }])),
    payloads: variant.startsWith("sql") ? SQL_PAYLOADS : MONGO_PAYLOADS,
      liveLab: Boolean(lab?.enabled),
    localOnly: !hosted
  }));
  app.use("/api", (req, res, next) => express.json({ limit: req.path.startsWith("/live-lab/") ? "4mb" : "16kb" })(req, res, next));
  app.use("/api", session({
    name: cookieName, secret, store: new DatabaseStore(repo), resave: false, saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "strict", secure: hosted, maxAge: sessionMaxAge }
  }));
  app.use("/api", (req, res, next) => {
    if (!req.session.csrfToken) req.session.csrfToken = token();
    if (["POST", "PATCH", "DELETE", "PUT"].includes(req.method)) {
      const origin = req.get("origin");
      if (origin && origin !== req.protocol + "://" + req.get("host")) return next(fail(403, "CSRF_ORIGIN", "Origin không hợp lệ.", "errors.csrfOrigin"));
      if (!sameToken(req.session.csrfToken, req.get("x-csrf-token"))) return next(fail(403, "CSRF_TOKEN", "Phiên đã thay đổi. Vui lòng tải lại trang.", "errors.csrfToken"));
    }
    next();
  });
  const currentUser = async req => {
    const user = req.session.userId ? await repo.userById(req.session.userId) : null;
    return user?.active ? publicUser(user) : null;
  };
  app.get("/api/auth/session", asyncRoute(async (req, res) => {
    res.json({ user: await currentUser(req), csrfToken: req.session.csrfToken, diagnostic: localizeDiagnostic(req.session.diagnostic, req.locale) });
  }));
  app.post("/api/auth/login", asyncRoute(async (req, res) => {
    const now = Date.now(), key = req.ip;
    let count = attempts.get(key);
    if (!count || count.until < now) { count = { n: 0, until: now + 60000 }; attempts.set(key, count); }
    for (const [ip, entry] of attempts) if (entry.until < now) attempts.delete(ip);
    if (++count.n > 100) throw fail(429, "RATE_LIMIT", "Quá nhiều lần đăng nhập. Thử lại sau một phút.", "errors.rateLimit");
    let input, user, detail;
    try {
      input = loginInput(req.body, variant);
      if (definition.safe) {
        const candidate = await repo.userByUsername(input.username);
        user = candidate && verifyPassword(input.password, candidate.passwordHash) ? candidate : null;
      } else {
        try { user = await repo.unsafeLogin(input.username, input.password); }
        catch (error) {
          if (error.code === "ER_PARSE_ERROR") throw fail(400, "QUERY_SYNTAX", "Payload làm câu SQL sai cú pháp.", "errors.sqlSyntax");
          throw error;
        }
      }
      if (!user?.active) user = null;
      detail = diagnostic(variant, input, Boolean(user));
    } catch (error) {
      if (error.status === 400) {
        if (!input) error.diagnostic = diagnostic(variant, { username: req.body?.username, password: req.body?.password }, false, true);
        await repo.audit({ id: randomUUID(), actor: "anonymous", action: "login", result: "rejected", payload: "invalid-input", createdAt: now });
      }
      throw error;
    }
    await repo.audit({ id: randomUUID(), actor: user?.username || "anonymous", action: "login", result: user ? "success" : "denied", payload: detail.payload, createdAt: now });
    if (!user) return res.status(401).json({ ok: false, code: "INVALID_CREDENTIALS", messageKey: "errors.invalidCredentials", messageParams: {}, message: translateApiMessage("errors.invalidCredentials", req.locale), diagnostic: localizeDiagnostic(detail, req.locale) });
    await new Promise((resolve, reject) => req.session.regenerate(err => err ? reject(err) : resolve()));
    req.session.userId = user.id;
    req.session.csrfToken = token();
    req.session.diagnostic = detail;
    await new Promise((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));
    res.json({ ok: true, user: publicUser(user), csrfToken: req.session.csrfToken, diagnostic: localizeDiagnostic(detail, req.locale) });
  }));
  app.post("/api/auth/logout", asyncRoute(async (req, res) => {
    await new Promise((resolve, reject) => req.session.destroy(err => err ? reject(err) : resolve()));
    res.clearCookie(cookieName, { path: "/", httpOnly: true, sameSite: "strict" }).json({ ok: true });
  }));
  app.use("/api", asyncRoute(async (req, res, next) => {
    req.user = await currentUser(req);
    if (!req.user) throw fail(401, "UNAUTHENTICATED", "Vui lòng đăng nhập.", "errors.unauthenticated");
    next();
  }));
  const requireLiveLab = (kind) => {
    if (!lab?.enabled || (kind && lab.kind !== kind)) throw fail(404, "LIVE_LAB_UNAVAILABLE", "Live lab không được bật cho biến thể này.", "errors.apiNotFound");
    return lab;
  };
  app.get("/api/live-lab/state", asyncRoute(async (req, res) => {
    res.json(await requireLiveLab().state());
  }));
  app.post("/api/live-lab/login", asyncRoute(async (req, res) => {
    const store = requireLiveLab();
    const { mode, username, password } = req.body || {};
    if (!["safe", "unsafe"].includes(mode) || typeof username !== "string" || !username.length) {
      throw fail(400, "INVALID_INPUT", "Thông tin lab không hợp lệ.", "errors.invalidInput");
    }
    try { res.json(await store.login(mode, username, password)); }
    catch (error) {
      if (error.code === "ER_PARSE_ERROR" || error.code === "ER_NO_SUCH_TABLE" || error.name === "MongoServerError") {
        return res.status(400).json({ ok: false, code: "LAB_QUERY_ERROR", message: "Sandbox database rejected this query." });
      }
      throw error;
    }
  }));
  app.post("/api/live-lab/delete", asyncRoute(async (req, res) => {
    const store = requireLiveLab("mongo");
    const { mode, owner } = req.body || {};
    if (!["safe", "unsafe"].includes(mode)) throw fail(400, "INVALID_INPUT", "Chế độ lab không hợp lệ.", "errors.invalidInput");
    try { res.json(await store.deleteOwner(mode, owner)); }
    catch (error) {
      if (error.name === "MongoServerError") return res.status(400).json({ ok: false, code: "LAB_QUERY_ERROR", message: "Sandbox database rejected this delete." });
      throw error;
    }
  }));
  app.post("/api/live-lab/reset", asyncRoute(async (req, res) => {
    const store = requireLiveLab();
    res.json({ ok: true, ...(await store.reset()) });
  }));
  app.get("/api/auth/me", (req, res) => res.json({ user: req.user }));
  const admin = (req, res, next) => req.user.role === "admin" ? next() : next(fail(403, "FORBIDDEN", "Chỉ admin được thực hiện thao tác này.", "errors.adminOnly"));
  app.post("/api/admin/demo/reset", admin, asyncRoute(async (req, res) => {
    if (typeof repo.resetDemoSeed !== "function") throw fail(503, "RESET_UNAVAILABLE", "Không thể khôi phục dữ liệu mẫu.", "errors.databaseUnavailable");
    const restored = await repo.resetDemoSeed();
    res.json({ ok: true, scope: "seed-users-and-tickets", ...restored });
  }));
  app.get("/api/dashboard", asyncRoute(async (req, res) => {
    const items = await repo.tickets(req.user.role === "admin" ? null : req.user.id);
    const counts = Object.fromEntries(STATUSES.map(status => [status, items.filter(t => t.status === status).length]));
    const users = req.user.role === "admin" ? await repo.users() : [];
    res.json({ total: items.length, counts, highPriority: items.filter(t => t.priority === "high" && t.status !== "resolved").length,
      users: users.length, recent: items.slice(0, 5), categories: ["academic","it","facilities","other"].map(id => ({ id, count: items.filter(t => t.category === id).length })) });
  }));
  app.get("/api/tickets", asyncRoute(async (req, res) => {
    let items = await repo.tickets(req.user.role === "admin" ? null : req.user.id);
    const search = String(req.query.search || "").slice(0, 160).toLowerCase();
    if (search) items = items.filter(t => (t.title + " " + t.code).toLowerCase().includes(search));
    if (STATUSES.includes(req.query.status)) items = items.filter(t => t.status === req.query.status);
    const page = Math.max(1, Math.min(1000, Number.parseInt(req.query.page, 10) || 1));
    const total = items.length;
    res.json({ items: items.slice((page - 1) * 8, page * 8), page, pages: Math.max(1, Math.ceil(total / 8)), total });
  }));
  const ownTicket = async req => {
    const ticket = await repo.ticketById(req.params.id);
    if (!ticket) throw fail(404, "NOT_FOUND", "Không tìm thấy yêu cầu.", "errors.ticketNotFound");
    if (req.user.role !== "admin" && ticket.ownerId !== req.user.id) throw fail(403, "FORBIDDEN", "Bạn không có quyền xem yêu cầu này.", "errors.forbiddenOwnership");
    return ticket;
  };
  app.get("/api/tickets/:id", asyncRoute(async (req, res) => res.json({ ticket: await ownTicket(req) })));
  app.post("/api/tickets", asyncRoute(async (req, res) => {
    const ticket = makeTicket(req.user.id, ticketInput(req.body));
    await repo.createTicket(ticket);
    res.status(201).json({ ticket });
  }));
  app.patch("/api/tickets/:id", admin, asyncRoute(async (req, res) => {
    const ticket = await ownTicket(req);
    const status = req.body.status ?? ticket.status, priority = req.body.priority ?? ticket.priority;
    if (!STATUSES.includes(status) || !PRIORITIES.includes(priority)) throw fail(400, "INVALID_INPUT", "Trạng thái hoặc ưu tiên không hợp lệ.", "errors.invalidStatusPriority");
    res.json({ ticket: await repo.updateTicket(ticket.id, { status, priority }) });
  }));
  app.get("/api/admin/users", admin, asyncRoute(async (req, res) => res.json({ users: (await repo.users()).map(publicUser) })));
  app.get("/api/admin/audit", admin, asyncRoute(async (req, res) => res.json({ events: await repo.events() })));
  app.post("/api/admin/users", admin, asyncRoute(async (req, res) => {
    const username = textField(req.body.username, "Username", 40, 3);
    if (!/^[a-zA-Z0-9_.-]+$/.test(username)) throw fail(400, "INVALID_INPUT", "Username chỉ nhận chữ, số, dấu chấm, gạch ngang.", "errors.invalidUsername");
    const password = textField(req.body.password, "Mật khẩu", 128, 8);
    const role = req.body.role || "user";
    if (!["user", "admin"].includes(role)) throw fail(400, "INVALID_INPUT", "Role không hợp lệ.", "errors.invalidRole");
    if (await repo.userByUsername(username)) throw fail(409, "DUPLICATE_USER", "Username đã tồn tại.", "errors.duplicateUser");
    const user = { id: randomUUID(), username, name: textField(req.body.name, "Họ tên", 120, 2), role,
      email: textField(req.body.email, "Email", 160), department: textField(req.body.department || "Sinh viên", "Đơn vị"), active: true,
      password: definition.safe ? null : password, passwordHash: definition.safe ? hashPassword(password) : null };
    await repo.createUser(user);
    res.status(201).json({ user: publicUser(user) });
  }));
  app.patch("/api/admin/users/:id", admin, asyncRoute(async (req, res) => {
    if (req.params.id === req.user.id) throw fail(400, "SELF_LOCK", "Không được khóa tài khoản đang sử dụng.", "errors.selfLock");
    const target = await repo.userById(req.params.id);
    if (!target) throw fail(404, "NOT_FOUND", "Không tìm thấy tài khoản.", "errors.accountNotFound");
    if (typeof req.body.active !== "boolean" || Object.keys(req.body).some(k => k !== "active")) throw fail(400, "INVALID_INPUT", "Chỉ nhận active kiểu boolean.", "errors.activeBoolean");
    res.json({ user: publicUser(await repo.updateUser(target.id, { active: req.body.active })) });
  }));
  app.patch("/api/profile", asyncRoute(async (req, res) => {
    if (Object.keys(req.body).some(key => !["name","email","department"].includes(key))) throw fail(400, "INVALID_INPUT", "Không được thay đổi role/id qua hồ sơ.", "errors.profileImmutable");
    const changes = {};
    for (const key of ["name", "email", "department"]) if (Object.hasOwn(req.body, key)) changes[key] = textField(req.body[key], key, key === "email" ? 160 : 120);
    if (changes.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(changes.email)) throw fail(400, "INVALID_INPUT", "Email không hợp lệ.", "errors.invalidEmail");
    res.json({ user: publicUser(await repo.updateUser(req.user.id, changes)) });
  }));
  app.use("/api", (req, res) => res.status(404).json({ code: "NOT_FOUND", messageKey: "errors.apiNotFound", messageParams: {}, message: translateApiMessage("errors.apiNotFound", req.locale) }));
  app.get("/favicon.ico", (req, res) => res.redirect("/favicon.svg"));
  app.use(express.static(path.resolve("dist")));
  app.get("*", (req, res) => res.sendFile(path.resolve("dist/index.html")));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.status || (error.type === "entity.too.large" ? 413 : 503);
    const messageKey = error.messageKey || (error.type === "entity.parse.failed" ? "errors.invalidJson" : status >= 500 ? "errors.databaseUnavailable" : "errors.invalidInput");
    const messageParams = error.messageParams || {};
    res.status(status).json({ ok: false, code: error.code || (status === 400 ? "INVALID_JSON" : "SERVICE_UNAVAILABLE"),
      messageKey, messageParams, message: translateApiMessage(messageKey, req.locale, messageParams),
      ...(error.diagnostic ? { diagnostic: error.diagnostic } : {}) });
  });
  return app;
}
