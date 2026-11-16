import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { VARIANTS, SQL_PAYLOADS, MONGO_PAYLOADS } from "../src/campus/domain.js";
const evidence = process.env.EVIDENCE_DIR || path.join("evidence", "campusdesk-" + new Date().toISOString().replaceAll(":", "-").slice(0, 19));
await mkdir(evidence, { recursive: true });
const results = [];
let currentVariant = "";
async function check(name, fn) {
  try { await fn(); results.push({ variant: currentVariant, name, pass: true }); console.log("PASS " + currentVariant + " " + name); }
  catch (error) { results.push({ variant: currentVariant, name, pass: false, error: error.message }); console.error("FAIL " + currentVariant + " " + name + ": " + error.message); }
}
function client(base) {
  let cookies = new Map(), csrf = "";
  return {
    cookie() { return [...cookies].map(([k,v]) => k + "=" + v).join("; "); },
    injectCookie(value) { cookies = new Map(value.split("; ").filter(Boolean).map(part => { const i = part.indexOf("="); return [part.slice(0,i),part.slice(i+1)]; })); },
    async request(route, method = "GET", body, options = {}) {
      const headers = { cookie: this.cookie(), ...(method !== "GET" && !options.noCsrf ? { "x-csrf-token": csrf } : {}), ...(body !== undefined ? { "content-type": "application/json" } : {}), ...options.headers };
      const response = await fetch(base + "/api" + route, { method, headers, body: body === undefined ? undefined : (options.raw ? body : JSON.stringify(body)) });
      const data = await response.json();
      for (const cookie of response.headers.getSetCookie()) {
        const pair = cookie.split(";")[0], i = pair.indexOf("=");
        cookies.set(pair.slice(0, i), pair.slice(i + 1));
      }
      if (data.csrfToken) csrf = data.csrfToken;
      return { status: response.status, data, headers: response.headers };
    },
    async init() { return this.request("/auth/session"); },
    async login(username = "admin", password = "Admin@123") { return this.request("/auth/login", "POST", { username, password }); },
    async logout() { const value = await this.request("/auth/logout", "POST"); await this.init(); return value; }
  };
}
const clients = {};
for (let retry = 0; ; retry++) {
  const statuses = await Promise.all(Object.values(VARIANTS).map(v => fetch((process.env.CAMPUS_BASE_HOST || "http://127.0.0.1") + ":" + v.port + "/api/health").then(r => r.status).catch(() => 0)));
  if (statuses.every(status => status === 200)) break;
  if (retry >= 120) throw new Error("Start all four Docker services and wait for health before integration tests.");
  await delay(500);
}
for (const [variant, definition] of Object.entries(VARIANTS)) {
  currentVariant = variant;
  const base = (process.env.CAMPUS_BASE_HOST || "http://127.0.0.1") + ":" + definition.port;
  const c = client(base); clients[variant] = c;
  await check("health is real database ready", async () => { const r = await c.request("/health"); assert.equal(r.status,200); assert.equal(r.data.variant,variant); });
  await check("configuration is fixed per server", async () => { const r=await c.request("/config"); assert.equal(r.data.safe,definition.safe); assert.equal(r.data.database,definition.database); });
  await check("anonymous cannot access dashboard", async () => assert.equal((await c.request("/dashboard")).status,401));
  await c.init();
  await check("CSRF required at login", async () => assert.equal((await c.request("/auth/login","POST",{ username:"admin",password:"Admin@123" },{noCsrf:true})).status,403));
  await check("cross-origin writes rejected", async () => assert.equal((await c.request("/auth/login","POST",{username:"admin",password:"Admin@123"},{headers:{origin:"http://localhost:9999"}})).status,403));
  await check("multibyte invalid CSRF does not crash server", async () => assert.equal((await c.request("/auth/login","POST",{username:"admin",password:"x"},{headers:{"x-csrf-token":"é".repeat(48)}})).status,403));
  await check("malformed JSON rejected", async () => assert.equal((await c.request("/auth/login","POST",'{"username":',{raw:true})).status,400));
  await check("oversized body rejected", async () => assert.equal((await c.request("/auth/login","POST",{ username:"admin",password:"x".repeat(20000) })).status,413));
  await check("object username rejected", async () => assert.equal((await c.login({$ne:""},"x")).status,400));
  await check("client role is not accepted", async () => assert.equal((await c.request("/auth/login","POST",{username:"admin",password:"Admin@123",role:"admin"})).status,400));
  await check("wrong password denied without session", async () => { assert.equal((await c.login("admin","wrong-password")).status,401); assert.equal((await c.request("/auth/me")).status,401); });
  await check("gt without dollar is rejected", async () => assert.equal((await c.login("admin",{gt:""})).status,400));
  await check("stringified operator stays a literal password", async () => {
    const r = await c.login("admin", JSON.stringify({ $gt: "" }));
    assert.equal(r.status,401);
    assert.equal(r.data.diagnostic.inputType,"string");
    assert.equal(r.data.diagnostic.authQueryExecuted,true);
    assert.equal((await c.request("/auth/me")).status,401);
  });
  await check("server-side JS operator excluded from teaching lab", async () => assert.equal((await c.login("admin",{$where:"true"})).status,400));
  const payloads = variant.startsWith("sql") ? SQL_PAYLOADS : MONGO_PAYLOADS;
  for (const payload of payloads) {
    await check("payload " + payload.id + ": " + (definition.safe ? "blocked" : "real admin bypass"), async () => {
      const r = await c.login(payload.username || "admin", payload.password);
      assert.equal(r.status, definition.safe ? (variant.startsWith("mongo") ? 400 : 401) : 200);
      if (definition.safe) {
        assert.equal((await c.request("/auth/me")).status,401);
        assert.equal(r.data.diagnostic.authQueryExecuted,variant.startsWith("sql"));
      }
      else {
        assert.equal(r.data.user.role,"admin"); assert.equal(r.data.user.username,"admin");
        assert.equal((await c.request("/auth/me")).data.user.role,"admin");
        assert.ok((await c.request("/dashboard")).data.total >= 12);
        assert.equal((await c.request("/admin/users")).status,200);
        await c.logout();
      }
    });
  }
  if (variant === "mongo-unsafe") await check("operator cannot authenticate nonexistent username", async () => assert.equal((await c.login("absent",{ $gt:"" })).status,401));
  if (variant === "sql-unsafe") await check("malformed SQL is reported without stack", async () => { const r=await c.login("admin","'"); assert.equal(r.status,400); assert.equal(r.data.code,"QUERY_SYNTAX"); });
  const oldCookie = c.cookie();
  await check("normal admin login rotates session", async () => { const r=await c.login(); assert.equal(r.status,200); assert.notEqual(c.cookie(),oldCookie); assert.match(r.headers.get("set-cookie"),/HttpOnly/); assert.match(r.headers.get("set-cookie"),/SameSite=Strict/); });
  await check("refresh session restores real admin", async () => assert.equal((await c.request("/auth/session")).data.user.role,"admin"));
  await check("public user never leaks password/hash", async () => { const user=(await c.request("/auth/me")).data.user; assert.equal(Object.hasOwn(user,"password"),false); assert.equal(Object.hasOwn(user,"passwordHash"),false); });
  await check("dashboard metrics use database", async () => { const d=(await c.request("/dashboard")).data; assert.ok(d.total >= 12); assert.equal(d.users >= 3,true); assert.equal(d.total,Object.values(d.counts).reduce((a,b)=>a+b,0)); });
  await check("tickets paginate and filter", async () => {
    const first=await c.request("/tickets"); assert.equal(first.data.items.length,8); assert.ok(first.data.pages >= 2);
    assert.ok((await c.request("/tickets?page=2")).data.items.length > 0);
    assert.ok((await c.request("/tickets?status=resolved")).data.items.every(t=>t.status==="resolved"));
    assert.equal((await c.request("/tickets?search=no-such-ticket-abcdef")).data.total,0);
  });
  await check("unknown ticket is 404", async () => assert.equal((await c.request("/tickets/not-found")).status,404));
  await check("admin can change ticket status, invalid enum rejected", async () => {
    assert.equal((await c.request("/tickets/ticket-001","PATCH",{status:"resolved",priority:"high"})).status,200);
    assert.equal((await c.request("/tickets/ticket-001","PATCH",{status:"fake"})).status,400);
  });
  await check("audit contains metadata only", async () => { const r=await c.request("/admin/audit"); assert.equal(r.status,200); assert.ok(r.data.events.length); assert.ok(!JSON.stringify(r.data).includes("Admin@123")); assert.ok(!JSON.stringify(r.data).includes("csrfToken")); });
  await check("admin cannot lock itself", async () => assert.equal((await c.request("/admin/users/admin-001","PATCH",{active:false})).status,400));
  const username="qa_" + Date.now(), newPassword="Synthetic@456";
  let newUserId;
  await check("admin creates usable user and rejects duplicate", async () => {
    const body={username,password:newPassword,name:"QA Synthetic User",role:"user",email:"qa@campus.example",department:"QA"};
    const r=await c.request("/admin/users","POST",body); assert.equal(r.status,201); newUserId=r.data.user.id;
    assert.equal((await c.request("/admin/users","POST",body)).status,409);
    assert.equal((await c.request("/admin/users","POST",{...body,username:username+"x",role:"superadmin"})).status,400);
    const n=client(base); await n.init(); assert.equal((await n.login(username,newPassword)).status,200); await n.logout();
  });
  if (variant === "sql-unsafe") await check("tautology still returns real admin after creating extra accounts", async () => {
    const r=await c.login(SQL_PAYLOADS[0].username,SQL_PAYLOADS[0].password);
    assert.equal(r.status,200);assert.equal(r.data.user.role,"admin");
    assert.equal((await c.request("/admin/users")).status,200);
  });
  const u=client(base); await u.init();
  await check("normal student login creates user session", async () => { assert.equal((await u.login("student","Student@123")).data.user.role,"user"); });
  for (const route of ["/admin/users","/admin/audit"]) await check("student denied " + route, async () => assert.equal((await u.request(route)).status,403));
  await check("student cannot create users or change ticket status", async () => {
    assert.equal((await u.request("/admin/users","POST",{username:"x"})).status,403);
    assert.equal((await u.request("/tickets/ticket-002","PATCH",{status:"resolved"})).status,403);
  });
  await check("student sees only own metrics/tickets", async () => {
    const items=(await u.request("/tickets")).data; assert.ok(items.items.every(t=>t.ownerId==="user-001"));
    assert.equal((await u.request("/dashboard")).data.total,items.total); assert.ok(items.total>=8);
  });
  await check("other student's ticket denied by backend", async () => assert.equal((await u.request("/tickets/ticket-001")).status,403));
  await check("profile cannot escalate role or id", async () => assert.equal((await u.request("/profile","PATCH",{role:"admin",id:"admin-001"})).status,400));
  await check("profile update persists", async () => {
    assert.equal((await u.request("/profile","PATCH",{name:"Nguyễn Minh Anh QA",email:"student@campus.example",department:"Công nghệ thông tin"})).status,200);
    assert.equal((await u.request("/auth/me")).data.user.name,"Nguyễn Minh Anh QA");
    assert.equal((await u.request("/profile","PATCH",{email:"not-email"})).status,400);
  });
  let ticketId;
  await check("ticket create preserves literal injection text and ignores forged owner", async () => {
    const r=await u.request("/tickets","POST",{title:"QA literal ' OR 1=1 --",description:"Synthetic content <img src=x onerror=alert(1)> must remain text.",category:"it",priority:"high",ownerId:"admin-001"});
    assert.equal(r.status,201); assert.equal(r.data.ticket.ownerId,"user-001"); ticketId=r.data.ticket.id;
    assert.equal((await u.request("/tickets/"+ticketId)).data.ticket.title,"QA literal ' OR 1=1 --");
    assert.equal((await u.request("/tickets","POST",{title:"x",description:"small"})).status,400);
  });
  await check("second user cannot view created ticket", async () => { const other=client(base); await other.init(); await other.login("student2","Student2@123"); assert.equal((await other.request("/tickets/"+ticketId)).status,403); await other.logout(); });
  await check("cookie role spoof does not grant admin", async () => { const cookie=u.cookie(); u.injectCookie(cookie+"; role=admin"); assert.equal((await u.request("/admin/users")).status,403); u.injectCookie(cookie); });
  await check("locked accounts lose already-issued session and cannot log in", async () => {
    assert.equal((await c.request("/admin/users/user-001","PATCH",{active:false})).status,200);
    assert.equal((await u.request("/auth/me")).status,401);
    const locked=client(base); await locked.init(); assert.equal((await locked.login("student","Student@123")).status,401);
    if (variant === "mongo-unsafe") assert.equal((await locked.login("student",{ $gt:"" })).status,401);
    assert.equal((await c.request("/admin/users/user-001","PATCH",{active:true})).status,200);
  });
  await check("new account lock type validation", async () => assert.equal((await c.request("/admin/users/"+newUserId,"PATCH",{active:"false"})).status,400));
  await check("logout destroys server-side session", async () => {
    const stale=u.cookie(); await u.logout(); u.injectCookie(stale);
    assert.equal((await u.request("/auth/me")).status,401); assert.equal((await u.request("/dashboard")).status,401);
  });
  await check("HTTP security and no-store headers present", async () => {
    const r=await c.request("/auth/me"); assert.equal(r.headers.get("cache-control"),"no-store"); assert.equal(r.headers.get("x-frame-options"),"DENY"); assert.ok(r.headers.get("content-security-policy"));
  });
}
for (const [source, sourceClient] of Object.entries(clients)) for (const [target, definition] of Object.entries(VARIANTS)) {
  if (source===target) continue;
  currentVariant=target;
  await check("session cookie from "+source+" cannot authenticate here", async () => {
    const other=client((process.env.CAMPUS_BASE_HOST || "http://127.0.0.1")+":"+definition.port);
    other.injectCookie(sourceClient.cookie());
    assert.equal((await other.request("/auth/me")).status,401);
  });
}
const summary={ generatedAt:new Date().toISOString(), environment:"real Docker MySQL/MongoDB via HTTP; synthetic data only", total:results.length, passed:results.filter(r=>r.pass).length, failed:results.filter(r=>!r.pass).length, results };
await writeFile(path.join(evidence,"api-results.json"),JSON.stringify(summary,null,2));
await writeFile(path.join(evidence,"api-results.log"),results.map(r=>(r.pass?"PASS":"FAIL")+" "+r.variant+" "+r.name+(r.error?": "+r.error:"")).join("\n")+"\n");
console.log(JSON.stringify({evidence,total:summary.total,passed:summary.passed,failed:summary.failed}));
if (summary.failed) process.exitCode=1;
