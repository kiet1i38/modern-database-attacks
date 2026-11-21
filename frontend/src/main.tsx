import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";
import { Theme, Button, TextField, Badge, Dialog, Select, TextArea, Callout } from "@radix-ui/themes";
import { SquaresFour, Ticket as TicketIcon, Users, UserCircle, SignOut, Plus, MagnifyingGlass, ArrowRight, ArrowLeft, List, ShieldWarning, Flask, ArrowClockwise, CheckCircle, Clock, GraduationCap, ChartBar } from "@phosphor-icons/react";
import "@radix-ui/themes/styles.css";
import "./styles.css";
import { DemoPanel } from "./demo-panel";
import { LiveLabPanel } from "./live-lab";
import i18n from "./i18n";
import { formatDate, formatDateTime, formatNumber } from "./i18n/format";
import type { Language } from "./i18n/language";
import { LanguageSwitcher } from "./components/LanguageSwitcher";

type User = { id: string; username: string; name: string; email: string; department: string; role: "admin" | "user"; active: boolean };
type Ticket = { id: string; code: string; ownerId: string; title: string; description: string; category: string; priority: string; status: string; createdAt: number };
type Payload = { id: string; label: string; username?: string; password: string | object };
type Config = { variant: string; database: string; safe: boolean; localOnly: boolean; liveLab?: boolean; payloads: Payload[]; variants: Record<string, { database: string; safe: boolean; port: number; url?: string }> };
type Diagnostic = { success: boolean; payload: string; inputType: string; authQueryExecuted: boolean; queryTemplate: string; request: unknown; explanation: string; explanationKey?: string };
type Dashboard = { total: number; counts: Record<string, number>; highPriority: number; users: number; recent: Ticket[]; categories: { id: string; count: number }[] };
type ListData = { items: Ticket[]; total: number; page: number; pages: number };
type Page = "overview" | "tickets" | "users" | "profile" | "lab";
type ApiError = Error & { status?: number; diagnostic?: Diagnostic; messageKey?: string; messageParams?: Record<string, string | number> };
const statusNames: Record<string, string> = { open: "status.open", in_progress: "status.in_progress", resolved: "status.resolved" };
const priorityNames: Record<string, string> = { low: "priority.low", medium: "priority.medium", high: "priority.high" };
const categoryNames: Record<string, string> = { academic: "category.academic", it: "category.it", facilities: "category.facilities", other: "category.other" };
const pages: Record<Page, string> = { overview: "navigation.overview", tickets: "navigation.tickets", users: "navigation.users", profile: "navigation.profile", lab: "navigation.lab" };
const navIcons = { overview: SquaresFour, tickets: TicketIcon, users: Users, profile: UserCircle, lab: Flask };
const roleNames = { admin: "roles.admin", user: "roles.user" };
let csrfToken = "";
function tx(key: string, options?: Record<string, string | number>): string {
  return String(i18n.t(key, options as never));
}
function activeLanguage(): Language { return i18n.resolvedLanguage === "en" ? "en" : "vi"; }
function errorKey(error: unknown): string {
  const value = error as ApiError;
  if (value?.messageKey) return value.messageKey;
  if (error instanceof SyntaxError) return "errors.invalidJson";
  if (value?.status === 401) return "errors.unauthenticated";
  if (value instanceof TypeError) return "errors.network";
  return "errors.generic";
}
async function api<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch("/api" + url, {
    method, credentials: "same-origin",
    headers: { "Accept-Language": activeLanguage(), ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(method !== "GET" ? { "X-CSRF-Token": csrfToken } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await response.json();
  if (data.csrfToken) csrfToken = data.csrfToken;
  if (!response.ok) throw Object.assign(new Error(data.message || tx("errors.generic")), { status: response.status, diagnostic: data.diagnostic,
    messageKey: data.messageKey || (data.code === "INVALID_CREDENTIALS" ? "errors.invalidCredentials" : data.code === "SERVICE_UNAVAILABLE" ? "errors.databaseUnavailable" : data.code === "LAB_QUERY_ERROR" ? "errors.liveLabQuery" : undefined),
    messageParams: data.messageParams || {} });
  return data;
}
function VariantBadge({ config }: { config: Config }) {
  return <Badge size="2" color={config.safe ? "teal" : "amber"}><span className="badge-dot" />{config.database} · {tx(config.safe ? "variant.safe" : "variant.unsafe").toUpperCase()}</Badge>;
}
function localizedVariant(config: Config): string {
  const database = config.database === "MySQL" ? "variant.sql" : "variant.mongo";
  return `${tx(database)} ${tx(config.safe ? "variant.safe" : "variant.unsafe")}`;
}
function localizedPayload(config: Config, payload: string): string {
  const fixed: Record<string, string> = {
    normal: "audit.normal", operator: "audit.operatorInput",
    "invalid-input": "audit.invalidInput", "malformed-sql": "audit.malformedSql"
  };
  if (fixed[payload]) return tx(fixed[payload]);
  const family = config.database === "MySQL" ? "sql" : "mongo";
  return tx(`lab.payloads.${family}.${payload}`, { defaultValue: payload });
}
function CampusBrand() {
  return <a href="/" className="brand" aria-label={tx("app.brandHome")}>
    <GraduationCap size={24} weight="bold" aria-hidden="true" />CampusDesk
  </a>;
}
function ErrorNotice({ message }: { message: string }) { return message ? <Callout.Root color="red" role="alert"><Callout.Text>{tx(message)}</Callout.Text></Callout.Root> : null; }
function Status({ value }: { value: string }) { return <Badge color={value === "resolved" ? "teal" : value === "in_progress" ? "blue" : "gray"}>{tx(statusNames[value] || "status.open")}</Badge>; }
function VariantLinks({ config }: { config: Config }) {
  const language = activeLanguage();
  return <nav className="variant-links" aria-label={tx("navigation.variants")}>
    {Object.entries(config.variants).filter(([id, variant]) => config.localOnly || variant.url || id === config.variant).map(([id, variant]) => {
      const current = id === config.variant;
      let href = "/";
      if (!current && config.localOnly) {
        const localUrl = new URL("/", window.location.origin); localUrl.port = String(variant.port); localUrl.searchParams.set("lang", language); href = localUrl.toString();
      } else if (!current && variant.url) {
        const externalUrl = new URL(variant.url, window.location.origin); externalUrl.searchParams.set("lang", language); href = externalUrl.toString();
      }
      return <a key={id} className={current ? "current" : ""} aria-current={current ? "page" : undefined} href={href}>
        {tx(id.startsWith("sql") ? "variant.sql" : "variant.mongo")} <span>{tx(variant.safe ? "variant.safe" : "variant.unsafe")}</span><ArrowRight size={14} aria-hidden="true" />
      </a>;
    })}
  </nav>;
}
function Diagnostics({ detail, config }: { detail: Diagnostic | null; config: Config }) {
  return <div className="diagnostics"><div className="section-label"><Flask size={17} /> {tx("lab.observedQuery")}</div>
    {detail ? <><Badge color={detail.success ? "amber" : "teal"}>{tx(detail.success ? "lab.success" : "lab.denied")} · {localizedPayload(config, detail.payload)}</Badge><p>{tx("lab.passwordType")} <code>{detail.inputType}</code> · {tx("lab.authQuery")} <strong>{tx(detail.authQueryExecuted ? "lab.executed" : "lab.notExecuted")}</strong></p><pre>{detail.queryTemplate}</pre><p>{detail.explanationKey ? tx(detail.explanationKey) : detail.explanation}</p><p>{tx("lab.appDescription")}</p><details><summary>{tx("lab.requestRedacted")}</summary><pre>{JSON.stringify(detail.request, null, 2)}</pre></details></> : <p>{tx("lab.emptyDiagnostic")}</p>}
  </div>;
}
function Login({ config, onLogin }: { config: Config; onLogin: (user: User, detail: Diagnostic) => void }) {
  const [username, setUsername] = useState(""), [password, setPassword] = useState("");
  const [lab, setLab] = useState(false), [selection, setSelection] = useState(config.payloads[0]?.id ?? "");
  const [custom, setCustom] = useState(""), [customMode, setCustomMode] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [detail, setDetail] = useState<Diagnostic | null>(null);
  const payload = config.payloads.find(p => p.id === selection);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || (lab && !payload)) return;
    setError(""); setBusy(true); setDetail(null);
    try {
      let submittedUsername = username, submittedPassword: unknown = password;
      if (lab && payload) {
        if (customMode) submittedPassword = config.database === "MongoDB" ? JSON.parse(custom) : custom;
        else { submittedUsername = payload.username || username; submittedPassword = payload.password; }
      }
      const data = await api<{ user: User; diagnostic: Diagnostic }>("/auth/login", "POST", { username: submittedUsername, password: submittedPassword });
      onLogin(data.user, data.diagnostic);
    } catch (err) {
      const e = err as ApiError; setError(errorKey(e)); setDetail(e.diagnostic || null);
    } finally { setBusy(false); setPassword(""); }
  }
  return <div className="login-layout">
    <main className="login-panel">
      <div className="login-language-row"><CampusBrand /><LanguageSwitcher /></div>
      <div className="login-form-wrap panel">
        <h1>{tx("auth.title")}</h1>
        <p className="muted">{tx("auth.tagline")}</p>
        <form onSubmit={submit} className="stack">
          <label>{tx("auth.username")}<TextField.Root aria-label={tx("auth.username")} autoComplete="username" placeholder={tx("auth.usernamePlaceholder")} value={username} onChange={e => setUsername(e.target.value)} size="3" required /></label>
          {lab && <label>{tx("auth.demoPayload")}
            <Select.Root value={selection} disabled={busy} onValueChange={value => { setSelection(value); setError(""); setDetail(null); }}>
              <Select.Trigger aria-label={tx("auth.demoPayload")} />
              <Select.Content>
                {config.payloads.length > 0 && <Select.Group>
                  <Select.Label>{tx("auth.authenticationGroup")}</Select.Label>
                  {config.payloads.map(p => <Select.Item key={p.id} value={p.id}>{tx(`lab.payloads.${config.database === "MySQL" ? "sql" : "mongo"}.${p.id}`, { defaultValue: p.label })}</Select.Item>)}
                </Select.Group>}
              </Select.Content>
            </Select.Root>
          </label>}
          {!lab ? <label>{tx("auth.password")}<TextField.Root aria-label={tx("auth.password")} type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder={tx("auth.passwordPlaceholder")} size="3" required /></label> :
            payload && <>
              {!customMode && <pre className="payload-preview">{JSON.stringify({ username: payload.username || username, password: payload.password }, null, 2)}</pre>}
              <label className="checkbox"><input type="checkbox" checked={customMode} onChange={e => setCustomMode(e.target.checked)} /> {tx("auth.customPayload")}</label>
              {customMode && <label>{tx(config.database === "MongoDB" ? "auth.mongoPayload" : "auth.sqlPayload")}<TextArea aria-label={tx("auth.customPayload")} value={custom} onChange={e => setCustom(e.target.value)} required /></label>}
              <p className="form-note">{tx(config.safe ? "auth.safeNotice" : "auth.unsafeNotice")}</p>
            </>}
            <ErrorNotice message={error} />
            <Button type="submit" size="3" disabled={busy}>{busy ? tx("auth.signingIn") : lab ? tx("auth.sendPayload") : tx("auth.signIn")}<ArrowRight size={18} /></Button>
        </form>
          {lab && <Diagnostics detail={detail} config={config} />}
        <details className="demo-accounts">
          <summary>{tx("auth.demoAccounts")}</summary>
          <dl>
            <div><dt><code>admin</code></dt><dd><code>Admin@123</code></dd></div>
            <div><dt><code>student</code></dt><dd><code>Student@123</code></dd></div>
            <div><dt><code>student2</code></dt><dd><code>Student2@123</code></dd></div>
          </dl>
        </details>
        <Button type="button" variant="ghost" color="gray" className="login-mode" disabled={busy} onClick={() => { setLab(!lab); setError(""); setDetail(null); }}>
          {lab ? tx("auth.loginMode") : <><Flask size={16} aria-hidden="true" /> {tx("lab.demoInjection")}</>}
        </Button>
      </div>
      <section className="panel login-variants" aria-labelledby="login-variants-title">
        <h2 id="login-variants-title">{tx("auth.variantTitle")}</h2>
        <VariantLinks config={config} />
      </section>
    </main>
  </div>;
}
function TicketTable({ items, onOpen }: { items: Ticket[]; onOpen: (ticket: Ticket) => void }) {
  return <div className="table-scroll"><table><thead><tr><th>{tx("tickets.title")}</th><th>{tx("tickets.category")}</th><th>{tx("common.status")}</th><th>{tx("common.priority")}</th><th>{tx("tickets.sentDate")}</th><th /></tr></thead><tbody>
    {items.map(t => <tr key={t.id}><td><button className="ticket-link" onClick={() => onOpen(t)}><span className="ticket-code">{t.code}</span><strong>{t.title}</strong></button></td><td>{tx(categoryNames[t.category] || "category.other")}</td><td><Status value={t.status} /></td><td><span className={"priority " + t.priority}><i />{tx(priorityNames[t.priority] || "priority.medium")}</span></td><td>{formatDate(t.createdAt, activeLanguage())}</td><td><button aria-label={tx("tickets.view", { code: t.code })} className="icon-button" onClick={() => onOpen(t)}><ArrowRight size={18} /></button></td></tr>)}
    {!items.length && <tr><td colSpan={6} className="empty-state"><TicketIcon size={32} /><p>{tx("tickets.empty")}</p></td></tr>}
  </tbody></table></div>;
}
function Overview({ data, user, onOpen, onTickets, onCreate }: { data: Dashboard; user: User; onOpen: (ticket: Ticket) => void; onTickets: () => void; onCreate: () => void }) {
  const stats = [
    [tx("dashboard.totalRequests"), formatNumber(data.total, activeLanguage()), <TicketIcon size={23} />],
    [tx("dashboard.inProgress"), formatNumber(data.counts.in_progress, activeLanguage()), <Clock size={23} />],
    [tx("dashboard.completed"), formatNumber(data.counts.resolved, activeLanguage()), <CheckCircle size={23} />],
    [tx(user.role === "admin" ? "dashboard.users" : "dashboard.highPriority"), formatNumber(user.role === "admin" ? data.users : data.highPriority, activeLanguage()), <Users size={23} />]
  ];
  const resolved = Math.round((data.counts.resolved / (data.total || 1)) * 100);
  return <>
    <div className="welcome">
      <div>
        <h1>{tx("dashboard.greeting")}</h1>
        <p>{tx(user.role === "admin" ? "dashboard.adminSummary" : "dashboard.userSummary")}</p>
      </div>
      <Button size="3" onClick={onCreate}><Plus size={18} />{tx("dashboard.createRequest")}</Button>
    </div>
    <div className="stats-grid">{stats.map(([label, value, icon], i) =>
      <div className="stat" key={i}><div className="stat-top"><span>{label}</span><div className="stat-icon">{icon}</div></div><strong>{value}</strong></div>
    )}</div>
    <div className="chart-grid"><section className="panel"><div className="panel-head"><div><h2>{tx("dashboard.progress")}</h2><p>{tx("dashboard.distribution")}</p></div><ChartBar size={22} /></div><div className="progress-chart"><div className="donut" style={{ background: "conic-gradient(#208b74 0% " + resolved + "%, #edf1f1 " + resolved + "% 100%)" }}><div><strong>{new Intl.NumberFormat(activeLanguage() === "en" ? "en-US" : "vi-VN").format(resolved)}%</strong><span>{tx("dashboard.completedLabel")}</span></div></div><div className="legend">{Object.entries(statusNames).map(([key, label], i) => <div key={key}><span><i style={{ background: ["#b8c3ce","#5b85b7","#208b74"][i] }} />{tx(label)}</span><strong>{formatNumber(data.counts[key], activeLanguage())}</strong></div>)}</div></div></section>
      <section className="panel"><div className="panel-head"><div><h2>{tx("dashboard.requestGroups")}</h2><p>{tx("dashboard.byCategory")}</p></div><TicketIcon size={22} /></div><div className="bars">{data.categories.map(c => <div className="bar-row" key={c.id}><span>{tx(categoryNames[c.id] || "category.other")}</span><div><i style={{ width: Math.max(0, c.count / Math.max(1, ...data.categories.map(x => x.count)) * 100) + "%" }} /></div><strong>{formatNumber(c.count, activeLanguage())}</strong></div>)}</div></section></div>
    <section className="panel recent"><div className="panel-head"><div><h2>{tx("dashboard.recent")}</h2><p>{tx("dashboard.recentDescription")}</p></div><Button variant="ghost" onClick={onTickets}>{tx("dashboard.viewAll")}<ArrowRight size={17} /></Button></div><TicketTable items={data.recent} onOpen={onOpen} /></section>
  </>;
}
function App() {
  const { i18n: languageI18n } = useTranslation();
  const [config, setConfig] = useState<Config | null>(null), [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true), [fatal, setFatal] = useState(""), [page, setPage] = useState<Page>("overview");
  const [detail, setDetail] = useState<Diagnostic | null>(null), [drawer, setDrawer] = useState(false);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null), [tickets, setTickets] = useState<ListData | null>(null);
  const [users, setUsers] = useState<User[]>([]), [events, setEvents] = useState<{ id: string; actor: string; result: string; payload: string; createdAt: number }[]>([]);
  const [search, setSearch] = useState(""), [filter, setFilter] = useState("all"), [listPage, setListPage] = useState(1);
  const [refresh, setRefresh] = useState(0), [contentLoading, setContentLoading] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [newTicket, setNewTicket] = useState(false), [newUser, setNewUser] = useState(false);
  const [selected, setSelected] = useState<Ticket | null>(null), [editStatus, setEditStatus] = useState("open"), [editPriority, setEditPriority] = useState("medium"), [saving, setSaving] = useState(false);
  useEffect(() => {
    document.documentElement.lang = activeLanguage();
    if (config) document.title = tx("app.title", { variant: localizedVariant(config) });
  }, [languageI18n.resolvedLanguage, config?.variant]);
  async function bootstrap() {
    setLoading(true); setFatal("");
    try {
      const cfg = await api<Config>("/config");
      const session = await api<{ user: User | null; diagnostic: Diagnostic | null }>("/auth/session");
      setConfig(cfg); setUser(session.user); setDetail(session.diagnostic);
      if (!session.user) { setDashboard(null); setTickets(null); setUsers([]); setEvents([]); }
      document.title = tx("app.title", { variant: localizedVariant(cfg) });
    } catch (e) { setFatal(errorKey(e)); } finally { setLoading(false); }
  }
  useEffect(() => { void bootstrap(); }, []);
  useEffect(() => {
    if (!user) return;
    let active = true; setContentLoading(true); setError("");
    async function load() {
      try {
        if (page === "overview") { const value = await api<Dashboard>("/dashboard"); if (active) setDashboard(value); }
        if (page === "tickets") { const value = await api<ListData>("/tickets?search=" + encodeURIComponent(search) + "&status=" + filter + "&page=" + listPage); if (active) setTickets(value); }
        if (page === "users") { const value = await api<{ users: User[] }>("/admin/users"); if (active) setUsers(value.users); }
        if (page === "lab" && user?.role === "admin") { const value = await api<{ events: typeof events }>("/admin/audit"); if (active) setEvents(value.events); }
      } catch (e) { if (active) { if ((e as ApiError).status === 401) { setUser(null); void bootstrap(); } else setError(errorKey(e)); } }
      finally { if (active) setContentLoading(false); }
    }
    void load(); return () => { active = false; };
  }, [user?.id, page, search, filter, listPage, refresh]);
  function navigate(next: Page) { setPage(next); setDrawer(false); setError(""); setNotice(""); }
  async function openTicket(ticket: Ticket) {
    try { const data = await api<{ ticket: Ticket }>("/tickets/" + ticket.id); setSelected(data.ticket); setEditStatus(data.ticket.status); setEditPriority(data.ticket.priority); }
    catch (e) { setError(errorKey(e)); }
  }
  async function action(task: () => Promise<void>) {
    setSaving(true); setError(""); setNotice("");
    try { await task(); setRefresh(n => n + 1); }
    catch (e) { setError(errorKey(e)); }
    finally { setSaving(false); }
  }
  async function createTicket(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget));
    await action(async () => { await api("/tickets", "POST", values); setNewTicket(false); navigate("tickets"); setListPage(1); setNotice("tickets.created"); });
  }
  async function createUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget));
    await action(async () => { await api("/admin/users", "POST", values); setNewUser(false); setNotice("users.created"); });
  }
  async function resetDemoSeed() {
    if (!window.confirm(tx("demo.resetConfirm"))) return;
    await action(async () => {
      await api("/admin/demo/reset", "POST", {});
      setNotice("demo.resetSuccess");
    });
  }
  if (loading) return <div className="loading-page"><GraduationCap size={40} /><p>{tx("app.connecting")}</p></div>;
  if (fatal || !config) return <div className="loading-page"><LanguageSwitcher /><ShieldWarning size={40} /><h1>{tx("app.connectionFailed")}</h1><p role="alert">{tx(fatal || "errors.generic")}</p><Button onClick={bootstrap}>{tx("common.retry")}</Button></div>;
  if (!user) return <Login config={config} onLogin={(u, d) => { setDashboard(null); setTickets(null); setUsers([]); setEvents([]); setUser(u); setDetail(d); setPage("overview"); }} />;
  const initialLoading = contentLoading && ((page === "overview" && !dashboard) || (page === "tickets" && !tickets) || (page === "users" && !users.length));
  const nav: Page[] = ["overview", "tickets", ...(user.role === "admin" ? ["users" as const] : []), "profile", "lab"];
  return <div className="app-layout">
    <header className="workspace-header">
      <div className="workspace-header-inner">
        <CampusBrand />
        <div className="workspace-account">
          <span className="avatar" aria-hidden="true">{user.name.slice(0, 1)}</span>
          <div className="account-details"><strong>{user.name}</strong><span>{tx(roleNames[user.role])}</span></div>
          <LanguageSwitcher />
          <button type="button" className="icon-button" title={tx("auth.signOut")} aria-label={tx("auth.signOut")} disabled={saving} onClick={() => action(async () => { await api("/auth/logout", "POST"); await bootstrap(); })}><SignOut size={20} /></button>
          <button type="button" className="icon-button mobile-menu" aria-label={tx(drawer ? "navigation.closeMenu" : "navigation.openMenu")} aria-controls="workspace-nav" aria-expanded={drawer} onClick={() => setDrawer(!drawer)}><List size={23} /></button>
        </div>
      </div>
    </header>
    <nav id="workspace-nav" className={"sidebar workspace-nav" + (drawer ? " visible" : "")} aria-label={tx("navigation.main")}>
      {nav.map(item => {
        const Icon = navIcons[item];
        return <button type="button" key={item} aria-current={page === item ? "page" : undefined} onClick={() => navigate(item)}>
          <Icon size={19} aria-hidden="true" />{tx(pages[item])}
        </button>;
      })}
    </nav>
    <div className="app-main">
      <main className="content">
        {page !== "overview" && <div className="page-heading"><div><h1>{tx(pages[page])}</h1><p>{tx(page === "tickets" ? "tickets.description" : page === "users" ? "users.description" : page === "profile" ? "profile.description" : "lab.pageDescription")}</p></div>{page === "tickets" && <Button size="3" onClick={() => { setError(""); setNewTicket(true); }}><Plus size={18} />{tx("dashboard.createRequest")}</Button>}{page === "users" && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Button variant="soft" color="gray" disabled={saving} onClick={() => void resetDemoSeed()}>{tx("demo.resetSeed")}</Button><Button size="3" onClick={() => { setError(""); setNewUser(true); }}><Plus size={18} />{tx("users.create")}</Button></div>}</div>}
        <ErrorNotice message={error} />{notice && <Callout.Root color="teal" role="status"><Callout.Text>{tx(notice)}</Callout.Text></Callout.Root>}
        {initialLoading ? <div className="content-loading"><ArrowClockwise size={24} /><p>{tx("app.loadingData")}</p></div> :
          <>{page === "overview" && dashboard && <Overview data={dashboard} user={user} onOpen={openTicket} onTickets={() => navigate("tickets")} onCreate={() => { setError(""); setNewTicket(true); }} />}
            {page === "tickets" && <section className="panel"><div className="list-toolbar"><TextField.Root aria-label={tx("tickets.searchLabel")} value={search} onChange={e => { setSearch(e.target.value); setListPage(1); }} placeholder={tx("tickets.searchPlaceholder")}><TextField.Slot><MagnifyingGlass size={18} /></TextField.Slot></TextField.Root><Select.Root value={filter} onValueChange={v => { setFilter(v); setListPage(1); }}><Select.Trigger aria-label={tx("tickets.filterStatus")} /><Select.Content><Select.Item value="all">{tx("tickets.allStatuses")}</Select.Item>{Object.entries(statusNames).map(([key, label]) => <Select.Item value={key} key={key}>{tx(label)}</Select.Item>)}</Select.Content></Select.Root></div><TicketTable items={tickets?.items || []} onOpen={openTicket} /><div className="pagination"><span>{tx("tickets.pagination", { count: formatNumber(tickets?.total || 0, activeLanguage()), page: listPage, pages: tickets?.pages || 1 })}</span><div><Button variant="soft" disabled={listPage <= 1} aria-label={tx("tickets.pagePrevious")} onClick={() => setListPage(n => n - 1)}><ArrowLeft size={16} /></Button><Button variant="soft" disabled={listPage >= (tickets?.pages || 1)} aria-label={tx("tickets.pageNext")} onClick={() => setListPage(n => n + 1)}><ArrowRight size={16} /></Button></div></div></section>}
            {page === "users" && <section className="panel"><p className="muted small">{tx("demo.resetScope")}</p><div className="table-scroll"><table><thead><tr><th>{tx("users.title")}</th><th>{tx("users.department")}</th><th>{tx("users.role")}</th><th>{tx("users.state")}</th><th>{tx("users.actions")}</th></tr></thead><tbody>{users.map(u => <tr key={u.id}><td><strong>{u.name}</strong><div className="muted small">{u.username} · {u.email}</div></td><td>{u.department}</td><td><Badge color={u.role === "admin" ? "blue" : "gray"}>{tx(roleNames[u.role])}</Badge></td><td><Badge color={u.active ? "teal" : "red"}>{tx(u.active ? "users.active" : "users.locked")}</Badge></td><td><Button variant="soft" color={u.active ? "red" : "teal"} disabled={u.id === user.id || saving} onClick={() => action(async () => { await api("/admin/users/" + u.id, "PATCH", { active: !u.active }); setNotice(u.active ? "users.lockedNotice" : "users.unlockedNotice"); })}>{tx(u.active ? "users.lock" : "users.unlock")}</Button></td></tr>)}</tbody></table></div></section>}
            {page === "profile" && <section className="panel profile-panel"><div className="profile-banner"><span className="avatar big">{user.name.slice(0, 1)}</span><div><h2>{user.name}</h2><p>{user.username} · {tx(roleNames[user.role])}</p></div></div><form className="stack" onSubmit={e => { e.preventDefault(); const values = Object.fromEntries(new FormData(e.currentTarget)); void action(async () => { const data = await api<{ user: User }>("/profile", "PATCH", values); setUser(data.user); setNotice("profile.save"); }); }}><label>{tx("common.fullName")}<TextField.Root name="name" aria-label={tx("common.fullName")} defaultValue={user.name} required maxLength={120} /></label><label>{tx("common.email")}<TextField.Root name="email" aria-label={tx("common.email")} type="email" defaultValue={user.email} required maxLength={160} /></label><label>{tx("common.department")}<TextField.Root name="department" aria-label={tx("common.department")} defaultValue={user.department} required maxLength={120} /></label><Button type="submit" disabled={saving}>{tx("common.saveChanges")}</Button></form></section>}
            {page === "lab" && <><DemoPanel key={user.id} variant={config.variant} />{config.liveLab && <LiveLabPanel key={user.id + config.variant} kind={config.variant.startsWith("sql") ? "sql" : "mongo"} api={api} />}<section className="panel lab-overview"><VariantBadge config={config} /><h2>{tx("lab.currentSession")}</h2><Diagnostics detail={detail} config={config} /><VariantLinks config={config} /></section>{user.role === "admin" && <section className="panel recent"><div className="panel-head"><div><h2>{tx("audit.title")}</h2><p>{tx("audit.recent")}</p></div></div><div className="table-scroll"><table><thead><tr><th>{tx("common.time")}</th><th>{tx("common.account")}</th><th>{tx("common.result")}</th><th>{tx("common.requestType")}</th></tr></thead><tbody>{events.map(e => <tr key={e.id}><td>{formatDateTime(Number(e.createdAt), activeLanguage())}</td><td>{e.actor}</td><td><Badge color={e.result === "success" ? "teal" : "gray"}>{tx(e.result === "success" ? "audit.success" : "audit.denied")}</Badge></td><td>{localizedPayload(config, e.payload)}</td></tr>)}{!events.length && <tr><td colSpan={4}>{tx("audit.empty")}</td></tr>}</tbody></table></div></section>}</>}
          </>}
      </main>
    </div>
    <Dialog.Root open={newTicket} onOpenChange={setNewTicket}><Dialog.Content maxWidth="520px"><div className="dialog-title-row"><Dialog.Title>{tx("tickets.create")}</Dialog.Title><LanguageSwitcher /></div><Dialog.Description size="2" mb="4">{tx("tickets.description")}</Dialog.Description><form className="stack" onSubmit={createTicket}><label>{tx("tickets.titleField")}<TextField.Root name="title" aria-label={tx("tickets.titleField")} placeholder={tx("tickets.titlePlaceholder")} required minLength={3} maxLength={160} /></label><div className="form-row"><label>{tx("tickets.category")}<select name="category"><option value="academic">{tx("category.academic")}</option><option value="it">{tx("category.it")}</option><option value="facilities">{tx("category.facilities")}</option><option value="other">{tx("category.other")}</option></select></label><label>{tx("common.priority")}<select name="priority"><option value="medium">{tx("priority.medium")}</option><option value="low">{tx("priority.low")}</option><option value="high">{tx("priority.high")}</option></select></label></div><label>{tx("tickets.content")}<TextArea name="description" aria-label={tx("tickets.content")} required minLength={10} maxLength={3000} placeholder={tx("tickets.contentPlaceholder")} /></label><ErrorNotice message={error} /><div className="dialog-actions"><Button type="button" variant="soft" color="gray" onClick={() => setNewTicket(false)}>{tx("common.cancel")}</Button><Button type="submit" disabled={saving}>{tx("common.send")}<ArrowRight size={16} /></Button></div></form></Dialog.Content></Dialog.Root>
    <Dialog.Root open={newUser} onOpenChange={setNewUser}><Dialog.Content maxWidth="520px"><div className="dialog-title-row"><Dialog.Title>{tx("users.create")}</Dialog.Title><LanguageSwitcher /></div><Dialog.Description size="2" mb="4">{tx("users.createDescription")}</Dialog.Description><form className="stack" onSubmit={createUser}><label>{tx("common.fullName")}<TextField.Root name="name" aria-label={tx("common.fullName")} autoComplete="name" required minLength={2} maxLength={120} /></label><label>{tx("common.username")}<TextField.Root name="username" aria-label={tx("common.username")} autoComplete="username" required minLength={3} maxLength={40} pattern={"[a-zA-Z0-9_.\\-]+"} /></label><label>{tx("common.email")}<TextField.Root name="email" aria-label={tx("common.email")} type="email" autoComplete="email" required /></label><label>{tx("users.newPassword")}<TextField.Root name="password" aria-label={tx("users.newPassword")} type="password" required minLength={8} maxLength={128} autoComplete="new-password" /></label><div className="form-row"><label>{tx("users.role")}<select name="role"><option value="user">{tx("roles.user")}</option><option value="admin">{tx("roles.admin")}</option></select></label><label>{tx("common.department")}<TextField.Root name="department" aria-label={tx("common.department")} autoComplete="organization" defaultValue={tx("profile.departmentDefault")} required /></label></div><ErrorNotice message={error} /><div className="dialog-actions"><Button type="button" variant="soft" color="gray" onClick={() => setNewUser(false)}>{tx("common.cancel")}</Button><Button type="submit" disabled={saving}>{tx("users.create")}</Button></div></form></Dialog.Content></Dialog.Root>
    <Dialog.Root open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}><Dialog.Content maxWidth="620px"><div className="dialog-title-row"><Dialog.Title>{selected?.title}</Dialog.Title><LanguageSwitcher /></div><Dialog.Description size="2" mb="4">{selected?.code} · {selected ? tx(categoryNames[selected.category] || "category.other") : ""}</Dialog.Description>{selected && <><div className="ticket-detail-tags"><Status value={selected.status} /><Badge color="gray">{tx("tickets.priorityLabel", { priority: tx(priorityNames[selected.priority] || "priority.medium") })}</Badge></div><p className="ticket-description">{selected.description}</p><p className="muted small">{tx("tickets.sentOn", { date: formatDateTime(selected.createdAt, activeLanguage()) })}</p>{user.role === "admin" && <div className="form-row"><label>{tx("common.status")}<select aria-label={tx("common.status")} value={editStatus} onChange={e => setEditStatus(e.target.value)}>{Object.entries(statusNames).map(([key, label]) => <option key={key} value={key}>{tx(label)}</option>)}</select></label><label>{tx("common.priority")}<select aria-label={tx("common.priority")} value={editPriority} onChange={e => setEditPriority(e.target.value)}>{Object.entries(priorityNames).map(([key, label]) => <option key={key} value={key}>{tx(label)}</option>)}</select></label></div>}<ErrorNotice message={error} /><div className="dialog-actions"><Button variant="soft" color="gray" onClick={() => setSelected(null)}>{tx("common.close")}</Button>{user.role === "admin" && <Button disabled={saving} onClick={() => action(async () => { await api("/tickets/" + selected.id, "PATCH", { status: editStatus, priority: editPriority }); setSelected(null); setNotice("tickets.updated"); })}>{tx("common.saveUpdate")}</Button>}</div></>}</Dialog.Content></Dialog.Root>
  </div>;
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><Theme accentColor="teal" grayColor="slate" radius="medium" scaling="100%"><App /></Theme></React.StrictMode>);
