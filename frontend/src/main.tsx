import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Theme, Button, TextField, Badge, Dialog, Select, TextArea, Callout } from "@radix-ui/themes";
import { SquaresFour, Ticket as TicketIcon, Users, UserCircle, SignOut, Plus, MagnifyingGlass, ArrowRight, ArrowLeft, List, X, ShieldCheck, ShieldWarning, Flask, ArrowClockwise, CheckCircle, Clock, GraduationCap, CaretRight, ChartBar } from "@phosphor-icons/react";
import "@radix-ui/themes/styles.css";
import "./styles.css";

type User = { id: string; username: string; name: string; email: string; department: string; role: "admin" | "user"; active: boolean };
type Ticket = { id: string; code: string; ownerId: string; title: string; description: string; category: string; priority: string; status: string; createdAt: number };
type Payload = { id: string; label: string; username?: string; password: string | object };
type Config = { variant: string; database: string; safe: boolean; payloads: Payload[]; variants: Record<string, { database: string; safe: boolean; port: number }> };
type Diagnostic = { success: boolean; payload: string; inputType: string; authQueryExecuted: boolean; queryTemplate: string; request: unknown; explanation: string };
type Dashboard = { total: number; counts: Record<string, number>; highPriority: number; users: number; recent: Ticket[]; categories: { id: string; count: number }[] };
type ListData = { items: Ticket[]; total: number; page: number; pages: number };
type Page = "overview" | "tickets" | "users" | "profile" | "lab";
type ApiError = Error & { status?: number; diagnostic?: Diagnostic };
const statusNames: Record<string, string> = { open: "Mới tiếp nhận", in_progress: "Đang xử lý", resolved: "Đã hoàn tất" };
const priorityNames: Record<string, string> = { low: "Thấp", medium: "Trung bình", high: "Cao" };
const categoryNames: Record<string, string> = { academic: "Học vụ", it: "Công nghệ", facilities: "Cơ sở vật chất", other: "Khác" };
const pages: Record<Page, string> = { overview: "Tổng quan", tickets: "Yêu cầu hỗ trợ", users: "Người dùng", profile: "Hồ sơ cá nhân", lab: "Nhật ký & demo" };
let csrfToken = "";
async function api<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch("/api" + url, {
    method, credentials: "same-origin",
    headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(method !== "GET" ? { "X-CSRF-Token": csrfToken } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await response.json();
  if (data.csrfToken) csrfToken = data.csrfToken;
  if (!response.ok) throw Object.assign(new Error(data.message || "Không thể thực hiện thao tác."), { status: response.status, diagnostic: data.diagnostic });
  return data;
}
function VariantBadge({ config }: { config: Config }) {
  return <Badge size="2" color={config.safe ? "teal" : "amber"}><span className="badge-dot" />{config.database} · {config.safe ? "SAFE" : "UNSAFE"}</Badge>;
}
function ErrorNotice({ message }: { message: string }) { return message ? <Callout.Root color="red" role="alert"><Callout.Text>{message}</Callout.Text></Callout.Root> : null; }
function Status({ value }: { value: string }) { return <Badge color={value === "resolved" ? "teal" : value === "in_progress" ? "blue" : "gray"}>{statusNames[value]}</Badge>; }
function VariantLinks({ config }: { config: Config }) {
  return <div className="variant-links">{Object.entries(config.variants).map(([id, v]) => <a key={id} className={id === config.variant ? "current" : ""} href={window.location.protocol + "//" + window.location.hostname + ":" + v.port}>{id.startsWith("sql") ? "SQL" : "Mongo"} <span>{v.safe ? "Safe" : "Unsafe"}</span><ArrowRight size={14} /></a>)}</div>;
}
function Diagnostics({ detail }: { detail: Diagnostic | null }) {
  return <div className="diagnostics"><div className="section-label"><Flask size={17} /> Quan sát truy vấn</div>
    {detail ? <><Badge color={detail.success ? "amber" : "teal"}>{detail.success ? "Đăng nhập thành công" : "Bị từ chối"} · {detail.payload}</Badge><p>Kiểu password: <code>{detail.inputType}</code> · Truy vấn xác thực: <strong>{detail.authQueryExecuted ? "Đã chạy" : "Chưa chạy"}</strong></p><pre>{detail.queryTemplate}</pre><p>{detail.explanation}</p><p>Mô tả từ luồng ứng dụng; không phải trace của database.</p><details><summary>Request đã che thông tin đăng nhập thông thường</summary><pre>{JSON.stringify(detail.request, null, 2)}</pre></details></> : <p>Chọn một payload và gửi request. Kết quả sẽ đến từ database thật, không phải mô phỏng phía trình duyệt.</p>}
  </div>;
}
function Login({ config, onLogin }: { config: Config; onLogin: (user: User, detail: Diagnostic) => void }) {
  const [username, setUsername] = useState("admin"), [password, setPassword] = useState("");
  const [lab, setLab] = useState(false), [selection, setSelection] = useState(config.payloads[0]?.id || "");
  const [custom, setCustom] = useState(""), [customMode, setCustomMode] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [detail, setDetail] = useState<Diagnostic | null>(null);
  const payload = config.payloads.find(p => p.id === selection)!;
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(""); setBusy(true); setDetail(null);
    try {
      let submittedUsername = username, submittedPassword: unknown = password;
      if (lab) {
        if (customMode) submittedPassword = config.database === "MongoDB" ? JSON.parse(custom) : custom;
        else { submittedUsername = payload.username || username; submittedPassword = payload.password; }
      }
      const data = await api<{ user: User; diagnostic: Diagnostic }>("/auth/login", "POST", { username: submittedUsername, password: submittedPassword });
      onLogin(data.user, data.diagnostic);
    } catch (err) {
      const e = err as ApiError; setError(e.message); setDetail(e.diagnostic || null);
    } finally { setBusy(false); setPassword(""); }
  }
  return <div className="login-layout">
    <aside className="login-story">
      <a href="/" className="brand"><span className="brand-icon"><GraduationCap size={27} weight="bold" /></span>campusdesk<span className="brand-period">.</span></a>
      <div className="story-main"><div className="section-label light">CỔNG HỖ TRỢ SINH VIÊN</div><h1>Mọi yêu cầu.<br />Một nơi<br /><em>được lắng nghe.</em></h1><p>Kết nối sinh viên và bộ phận hỗ trợ. Theo dõi tiến độ, xử lý yêu cầu và quản lý công việc trong một không gian.</p>
        <div className="story-rule" /><div className="story-steps"><span><TicketIcon size={22} /> Gửi yêu cầu</span><CaretRight size={18} /><span><Clock size={22} /> Theo dõi</span><CaretRight size={18} /><span><CheckCircle size={22} /> Hoàn tất</span></div>
      </div><div className="story-footer"><span>MODERN DATABASE ATTACKS</span><span>Final project · Local lab</span></div>
    </aside>
    <main className="login-panel">
      <div className="login-top"><span>PHIÊN BẢN THỬ NGHIỆM</span><VariantBadge config={config} /></div>
      <div className="login-form-wrap"><div className="section-label">CHÀO MỪNG TRỞ LẠI</div><h2>Đăng nhập CampusDesk</h2><p className="muted">Truy cập không gian hỗ trợ của bạn.</p>
        <div className="login-tabs"><button className={!lab ? "selected" : ""} onClick={() => { setLab(false); setError(""); }}>Đăng nhập</button><button className={lab ? "selected" : ""} onClick={() => { setLab(true); setError(""); }}><Flask size={16} /> Demo injection</button></div>
        <form onSubmit={submit} className="stack">
          <label>Tên đăng nhập<TextField.Root aria-label="Tên đăng nhập" autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} size="3" required /></label>
          {!lab ? <label>Mật khẩu<TextField.Root aria-label="Mật khẩu" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Nhập mật khẩu" size="3" required /></label> :
            <><label>Payload demo<Select.Root value={selection} onValueChange={setSelection}><Select.Trigger aria-label="Payload demo" /><Select.Content>{config.payloads.map(p => <Select.Item key={p.id} value={p.id}>{p.label}</Select.Item>)}</Select.Content></Select.Root></label>
              {!customMode && <pre className="payload-preview">{JSON.stringify({ username: payload.username || username, password: payload.password }, null, 2)}</pre>}
              <label className="checkbox"><input type="checkbox" checked={customMode} onChange={e => setCustomMode(e.target.checked)} /> Nhập payload tùy chỉnh</label>
              {customMode && <label>{config.database === "MongoDB" ? "Password object (JSON)" : "Password SQL payload"}<TextArea aria-label="Payload tùy chỉnh" value={custom} onChange={e => setCustom(e.target.value)} required /></label>}
              <p className="form-note">{config.safe ? "Bản safe vẫn gửi cùng payload để kiểm tra backend chặn injection." : "Bản unsafe cố ý có lỗi xác thực. Chỉ dùng với dữ liệu demo tại localhost."}</p>
            </>}
          <ErrorNotice message={error} />
          <Button type="submit" size="3" disabled={busy}>{busy ? "Đang xác thực…" : lab ? "Gửi payload & đăng nhập" : "Đăng nhập"}<ArrowRight size={18} /></Button>
        </form>
        {lab && <Diagnostics detail={detail} />}
        <details className="demo-accounts"><summary>Tài khoản demo</summary><p><code>admin / Admin@123</code><br /><code>student / Student@123</code><br /><code>student2 / Student2@123</code></p></details>
      </div>
      <footer className="login-footer"><VariantLinks config={config} /><a href="/docs/" target="_blank" rel="noreferrer">Hướng dẫn chạy & thuyết trình <ArrowRight size={15} /></a></footer>
    </main>
  </div>;
}
function TicketTable({ items, onOpen }: { items: Ticket[]; onOpen: (ticket: Ticket) => void }) {
  return <div className="table-scroll"><table><thead><tr><th>Yêu cầu</th><th>Danh mục</th><th>Trạng thái</th><th>Ưu tiên</th><th>Ngày gửi</th><th /></tr></thead><tbody>
    {items.map(t => <tr key={t.id}><td><button className="ticket-link" onClick={() => onOpen(t)}><span className="ticket-code">{t.code}</span><strong>{t.title}</strong></button></td><td>{categoryNames[t.category]}</td><td><Status value={t.status} /></td><td><span className={"priority " + t.priority}><i />{priorityNames[t.priority]}</span></td><td>{new Date(t.createdAt).toLocaleDateString("vi-VN")}</td><td><button aria-label={"Xem " + t.code} className="icon-button" onClick={() => onOpen(t)}><ArrowRight size={18} /></button></td></tr>)}
    {!items.length && <tr><td colSpan={6} className="empty-state"><TicketIcon size={32} /><p>Chưa có yêu cầu phù hợp.</p></td></tr>}
  </tbody></table></div>;
}
function Overview({ data, user, onOpen, onTickets }: { data: Dashboard; user: User; onOpen: (ticket: Ticket) => void; onTickets: () => void }) {
  const stats = [
    ["Tổng yêu cầu", data.total, <TicketIcon size={23} />],
    ["Đang xử lý", data.counts.in_progress, <Clock size={23} />],
    ["Đã hoàn tất", data.counts.resolved, <CheckCircle size={23} />],
    [user.role === "admin" ? "Người dùng" : "Ưu tiên cao", user.role === "admin" ? data.users : data.highPriority, <Users size={23} />]
  ];
  const resolved = Math.round((data.counts.resolved / (data.total || 1)) * 100);
  return <><div className="welcome"><div><div className="section-label">KHÔNG GIAN {user.role === "admin" ? "QUẢN TRỊ" : "SINH VIÊN"}</div><h1>Chào {user.name.split(" ").slice(-2).join(" ")},</h1><p>Đây là tình hình {user.role === "admin" ? "hỗ trợ toàn hệ thống" : "các yêu cầu của bạn"} hôm nay.</p></div><div className="welcome-mark"><GraduationCap size={58} weight="duotone" /></div></div>
    <div className="stats-grid">{stats.map(([label, value, icon], i) => <div className="stat" key={i}><div className="stat-top"><span>{label}</span><div className="stat-icon">{icon}</div></div><strong>{value}</strong><div className="stat-foot">{i === 2 ? resolved + "% tổng yêu cầu" : i === 3 ? "Cập nhật từ database" : "Theo dữ liệu hiện tại"}</div></div>)}</div>
    <div className="chart-grid"><section className="panel"><div className="panel-head"><div><h2>Tiến độ hỗ trợ</h2><p>Phân bố theo trạng thái</p></div><ChartBar size={22} /></div><div className="progress-chart"><div className="donut" style={{ background: "conic-gradient(#208b74 0% " + resolved + "%, #edf1f1 " + resolved + "% 100%)" }}><div><strong>{resolved}%</strong><span>hoàn tất</span></div></div><div className="legend">{Object.entries(statusNames).map(([key, label], i) => <div key={key}><span><i style={{ background: ["#b8c3ce","#5b85b7","#208b74"][i] }} />{label}</span><strong>{data.counts[key]}</strong></div>)}</div></div></section>
      <section className="panel"><div className="panel-head"><div><h2>Nhóm yêu cầu</h2><p>Số lượng theo danh mục</p></div><TicketIcon size={22} /></div><div className="bars">{data.categories.map(c => <div className="bar-row" key={c.id}><span>{categoryNames[c.id]}</span><div><i style={{ width: Math.max(0, c.count / Math.max(1, ...data.categories.map(x => x.count)) * 100) + "%" }} /></div><strong>{c.count}</strong></div>)}</div></section></div>
    <section className="panel recent"><div className="panel-head"><div><h2>Yêu cầu gần đây</h2><p>Những cập nhật mới nhất trong không gian của bạn</p></div><Button variant="ghost" onClick={onTickets}>Xem tất cả<ArrowRight size={17} /></Button></div><TicketTable items={data.recent} onOpen={onOpen} /></section>
  </>;
}
function App() {
  const [config, setConfig] = useState<Config | null>(null), [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true), [fatal, setFatal] = useState(""), [page, setPage] = useState<Page>("overview");
  const [detail, setDetail] = useState<Diagnostic | null>(null), [drawer, setDrawer] = useState(false);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null), [tickets, setTickets] = useState<ListData | null>(null);
  const [users, setUsers] = useState<User[]>([]), [events, setEvents] = useState<{ id: string; actor: string; result: string; payload: string; createdAt: number }[]>([]);
  const [search, setSearch] = useState(""), [filter, setFilter] = useState("all"), [listPage, setListPage] = useState(1);
  const [refresh, setRefresh] = useState(0), [contentLoading, setContentLoading] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [newTicket, setNewTicket] = useState(false), [newUser, setNewUser] = useState(false);
  const [selected, setSelected] = useState<Ticket | null>(null), [editStatus, setEditStatus] = useState("open"), [editPriority, setEditPriority] = useState("medium"), [saving, setSaving] = useState(false);
  async function bootstrap() {
    setLoading(true); setFatal("");
    try {
      const cfg = await api<Config>("/config");
      const session = await api<{ user: User | null; diagnostic: Diagnostic | null }>("/auth/session");
      setConfig(cfg); setUser(session.user); setDetail(session.diagnostic);
      if (!session.user) { setDashboard(null); setTickets(null); setUsers([]); setEvents([]); }
      document.title = "CampusDesk · " + cfg.variant;
    } catch (e) { setFatal((e as Error).message); } finally { setLoading(false); }
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
      } catch (e) { if (active) { if ((e as ApiError).status === 401) { setUser(null); void bootstrap(); } else setError((e as Error).message); } }
      finally { if (active) setContentLoading(false); }
    }
    void load(); return () => { active = false; };
  }, [user?.id, page, search, filter, listPage, refresh]);
  function navigate(next: Page) { setPage(next); setDrawer(false); setError(""); setNotice(""); }
  async function openTicket(ticket: Ticket) {
    try { const data = await api<{ ticket: Ticket }>("/tickets/" + ticket.id); setSelected(data.ticket); setEditStatus(data.ticket.status); setEditPriority(data.ticket.priority); }
    catch (e) { setError((e as Error).message); }
  }
  async function action(task: () => Promise<void>) {
    setSaving(true); setError(""); setNotice("");
    try { await task(); setRefresh(n => n + 1); }
    catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }
  async function createTicket(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget));
    await action(async () => { await api("/tickets", "POST", values); setNewTicket(false); navigate("tickets"); setListPage(1); setNotice("Yêu cầu đã được gửi thành công."); });
  }
  async function createUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget));
    await action(async () => { await api("/admin/users", "POST", values); setNewUser(false); setNotice("Đã tạo tài khoản."); });
  }
  if (loading) return <div className="loading-page"><GraduationCap size={40} /><p>Đang kết nối CampusDesk…</p></div>;
  if (fatal || !config) return <div className="loading-page"><ShieldWarning size={40} /><h1>Chưa thể kết nối</h1><p role="alert">{fatal}</p><Button onClick={bootstrap}>Thử lại</Button></div>;
  if (!user) return <Login config={config} onLogin={(u, d) => { setDashboard(null); setTickets(null); setUsers([]); setEvents([]); setUser(u); setDetail(d); setPage("overview"); }} />;
  const initialLoading = contentLoading && ((page === "overview" && !dashboard) || (page === "tickets" && !tickets) || (page === "users" && !users.length));
  const nav = [{ id: "overview", icon: SquaresFour }, { id: "tickets", icon: TicketIcon }, ...(user.role === "admin" ? [{ id: "users", icon: Users }] : []), { id: "profile", icon: UserCircle }, { id: "lab", icon: Flask }] as { id: Page; icon: typeof SquaresFour }[];
  return <div className="app-layout">
    {drawer && <button className="mobile-overlay" aria-label="Đóng menu" onClick={() => setDrawer(false)} />}
    <aside className={"sidebar " + (drawer ? "visible" : "")}>
      <a href="/" className="brand"><span className="brand-icon"><GraduationCap size={26} weight="bold" /></span>campusdesk<span className="brand-period">.</span></a>
      <div className="workspace-tag"><span className="workspace-icon"><GraduationCap size={20} /></span><div><strong>Campus Workspace</strong><span>{user.role === "admin" ? "Không gian quản trị" : "Không gian sinh viên"}</span></div></div>
      <div className="nav-heading">WORKSPACE</div><nav>{nav.map(item => <button key={item.id} className={page === item.id ? "active" : ""} onClick={() => navigate(item.id)}><item.icon size={21} weight={page === item.id ? "fill" : "regular"} />{pages[item.id]}{page === item.id && <span className="nav-dot" />}</button>)}</nav>
      <div className="sidebar-bottom"><div className="lab-card">{config.safe ? <ShieldCheck size={24} /> : <ShieldWarning size={24} />}<strong>{config.database} {config.safe ? "Safe" : "Unsafe"}</strong><p>Lab dữ liệu giả lập.<br />Chỉ chạy tại localhost.</p><a href="/docs/" target="_blank" rel="noreferrer">Mở hướng dẫn<ArrowRight size={16} /></a></div><div className="sidebar-user"><span className="avatar">{user.name.slice(0, 1)}</span><div><strong>{user.name}</strong><span>{user.role === "admin" ? "Administrator" : "Student"}</span></div><button className="icon-button" title="Đăng xuất" aria-label="Đăng xuất" onClick={() => action(async () => { await api("/auth/logout", "POST"); await bootstrap(); })}><SignOut size={21} /></button></div></div>
    </aside>
    <div className="app-main"><header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" aria-label="Mở menu" onClick={() => setDrawer(!drawer)}><List size={24} /></button><span>Workspace</span><CaretRight size={14} /><strong>{pages[page]}</strong></div><div className="topbar-right"><VariantBadge config={config} /><Badge color="gray">{user.role.toUpperCase()}</Badge></div></header>
      <main className="content">
        {page !== "overview" && <div className="page-heading"><div><div className="section-label">CAMPUS WORKSPACE</div><h1>{pages[page]}</h1><p>{page === "tickets" ? "Theo dõi và quản lý những điều cần hỗ trợ." : page === "users" ? "Quản lý tài khoản và quyền truy cập hệ thống." : page === "profile" ? "Thông tin cá nhân trong không gian của bạn." : "Đối chiếu kết quả xác thực và nguyên nhân injection."}</p></div>{page === "tickets" && <Button size="3" onClick={() => { setError(""); setNewTicket(true); }}><Plus size={18} />Tạo yêu cầu</Button>}{page === "users" && <Button size="3" onClick={() => { setError(""); setNewUser(true); }}><Plus size={18} />Tạo tài khoản</Button>}</div>}
        <ErrorNotice message={error} />{notice && <Callout.Root color="teal" role="status"><Callout.Text>{notice}</Callout.Text></Callout.Root>}
        {initialLoading ? <div className="content-loading"><ArrowClockwise size={24} /><p>Đang lấy dữ liệu…</p></div> :
          <>{page === "overview" && dashboard && <><div className="overview-actions"><Button size="2" onClick={() => { setError(""); setNewTicket(true); }}><Plus size={16} />Tạo yêu cầu</Button></div><Overview data={dashboard} user={user} onOpen={openTicket} onTickets={() => navigate("tickets")} /></>}
            {page === "tickets" && <section className="panel"><div className="list-toolbar"><TextField.Root aria-label="Tìm yêu cầu" value={search} onChange={e => { setSearch(e.target.value); setListPage(1); }} placeholder="Tìm tiêu đề hoặc mã yêu cầu…"><TextField.Slot><MagnifyingGlass size={18} /></TextField.Slot></TextField.Root><Select.Root value={filter} onValueChange={v => { setFilter(v); setListPage(1); }}><Select.Trigger aria-label="Lọc trạng thái" /><Select.Content><Select.Item value="all">Tất cả trạng thái</Select.Item>{Object.entries(statusNames).map(([key, label]) => <Select.Item value={key} key={key}>{label}</Select.Item>)}</Select.Content></Select.Root></div><TicketTable items={tickets?.items || []} onOpen={openTicket} /><div className="pagination"><span>{tickets?.total || 0} yêu cầu · Trang {listPage}/{tickets?.pages || 1}</span><div><Button variant="soft" disabled={listPage <= 1} aria-label="Trang trước" onClick={() => setListPage(n => n - 1)}><ArrowLeft size={16} /></Button><Button variant="soft" disabled={listPage >= (tickets?.pages || 1)} aria-label="Trang sau" onClick={() => setListPage(n => n + 1)}><ArrowRight size={16} /></Button></div></div></section>}
            {page === "users" && <section className="panel"><div className="table-scroll"><table><thead><tr><th>Người dùng</th><th>Đơn vị</th><th>Role</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{users.map(u => <tr key={u.id}><td><strong>{u.name}</strong><div className="muted small">{u.username} · {u.email}</div></td><td>{u.department}</td><td><Badge color={u.role === "admin" ? "blue" : "gray"}>{u.role}</Badge></td><td><Badge color={u.active ? "teal" : "red"}>{u.active ? "Hoạt động" : "Đã khóa"}</Badge></td><td><Button variant="soft" color={u.active ? "red" : "teal"} disabled={u.id === user.id || saving} onClick={() => action(async () => { await api("/admin/users/" + u.id, "PATCH", { active: !u.active }); setNotice(u.active ? "Tài khoản đã bị khóa." : "Đã mở khóa tài khoản."); })}>{u.active ? "Khóa" : "Mở khóa"}</Button></td></tr>)}</tbody></table></div></section>}
            {page === "profile" && <section className="panel profile-panel"><div className="profile-banner"><span className="avatar big">{user.name.slice(0, 1)}</span><div><h2>{user.name}</h2><p>{user.username} · {user.role}</p></div></div><form className="stack" onSubmit={e => { e.preventDefault(); const values = Object.fromEntries(new FormData(e.currentTarget)); void action(async () => { const data = await api<{ user: User }>("/profile", "PATCH", values); setUser(data.user); setNotice("Đã lưu hồ sơ."); }); }}><label>Họ tên<TextField.Root name="name" defaultValue={user.name} required maxLength={120} /></label><label>Email<TextField.Root name="email" type="email" defaultValue={user.email} required maxLength={160} /></label><label>Đơn vị<TextField.Root name="department" defaultValue={user.department} required maxLength={120} /></label><p className="form-note">Role được quản lý tại backend và không thể sửa qua hồ sơ.</p><Button type="submit" disabled={saving}>Lưu thay đổi</Button></form></section>}
            {page === "lab" && <><section className="panel lab-overview"><VariantBadge config={config} /><h2>Phiên đăng nhập hiện tại</h2><Diagnostics detail={detail} /><p className="muted">Sau khi đăng xuất, bạn có thể thử payload khác tại trang đăng nhập. Log không lưu mật khẩu thông thường hoặc cookie.</p><VariantLinks config={config} /></section>{user.role === "admin" && <section className="panel recent"><div className="panel-head"><div><h2>Nhật ký xác thực</h2><p>20 sự kiện gần nhất của phiên bản này</p></div></div><div className="table-scroll"><table><thead><tr><th>Thời gian</th><th>Tài khoản</th><th>Kết quả</th><th>Loại request</th></tr></thead><tbody>{events.map(e => <tr key={e.id}><td>{new Date(Number(e.createdAt)).toLocaleString("vi-VN")}</td><td>{e.actor}</td><td><Badge color={e.result === "success" ? "teal" : "gray"}>{e.result}</Badge></td><td>{e.payload}</td></tr>)}{!events.length && <tr><td colSpan={4}>Chưa có sự kiện.</td></tr>}</tbody></table></div></section>}</>}
          </>}
        <footer className="content-footer"><span>CampusDesk · Modern Database Attacks</span><span>Dữ liệu giả lập / {config.variant}</span></footer>
      </main>
    </div>
    <Dialog.Root open={newTicket} onOpenChange={setNewTicket}><Dialog.Content maxWidth="520px"><Dialog.Title>Tạo yêu cầu hỗ trợ</Dialog.Title><Dialog.Description size="2" mb="4">Mô tả vấn đề để bộ phận hỗ trợ tiếp nhận.</Dialog.Description><form className="stack" onSubmit={createTicket}><label>Tiêu đề<TextField.Root name="title" aria-label="Tiêu đề" placeholder="Bạn cần hỗ trợ điều gì?" required minLength={3} maxLength={160} /></label><div className="form-row"><label>Danh mục<select name="category"><option value="academic">Học vụ</option><option value="it">Công nghệ</option><option value="facilities">Cơ sở vật chất</option><option value="other">Khác</option></select></label><label>Ưu tiên<select name="priority"><option value="medium">Trung bình</option><option value="low">Thấp</option><option value="high">Cao</option></select></label></div><label>Nội dung<TextArea name="description" aria-label="Nội dung" required minLength={10} maxLength={3000} placeholder="Mô tả chi tiết vấn đề…" /></label><ErrorNotice message={error} /><div className="dialog-actions"><Button type="button" variant="soft" color="gray" onClick={() => setNewTicket(false)}>Hủy</Button><Button type="submit" disabled={saving}>Gửi yêu cầu<ArrowRight size={16} /></Button></div></form></Dialog.Content></Dialog.Root>
    <Dialog.Root open={newUser} onOpenChange={setNewUser}><Dialog.Content maxWidth="520px"><Dialog.Title>Tạo tài khoản</Dialog.Title><Dialog.Description size="2" mb="4">Tài khoản chỉ thuộc phiên bản hiện tại.</Dialog.Description><form className="stack" onSubmit={createUser}><label>Họ tên<TextField.Root name="name" aria-label="Họ tên" required minLength={2} maxLength={120} /></label><label>Username<TextField.Root name="username" aria-label="Username" required minLength={3} maxLength={40} pattern={"[a-zA-Z0-9_.\\-]+"} /></label><label>Email<TextField.Root name="email" aria-label="Email" type="email" required /></label><label>Mật khẩu mới<TextField.Root name="password" aria-label="Mật khẩu mới" type="password" required minLength={8} maxLength={128} autoComplete="new-password" /></label><div className="form-row"><label>Role<select name="role"><option value="user">User</option><option value="admin">Admin</option></select></label><label>Đơn vị<TextField.Root name="department" defaultValue="Công nghệ thông tin" required /></label></div><ErrorNotice message={error} /><div className="dialog-actions"><Button type="button" variant="soft" color="gray" onClick={() => setNewUser(false)}>Hủy</Button><Button type="submit" disabled={saving}>Tạo tài khoản</Button></div></form></Dialog.Content></Dialog.Root>
    <Dialog.Root open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}><Dialog.Content maxWidth="620px"><Dialog.Title>{selected?.title}</Dialog.Title><Dialog.Description size="2" mb="4">{selected?.code} · {selected ? categoryNames[selected.category] : ""}</Dialog.Description>{selected && <><div className="ticket-detail-tags"><Status value={selected.status} /><Badge color="gray">Ưu tiên {priorityNames[selected.priority]}</Badge></div><p className="ticket-description">{selected.description}</p><p className="muted small">Gửi ngày {new Date(selected.createdAt).toLocaleString("vi-VN")}</p>{user.role === "admin" && <div className="form-row"><label>Trạng thái<select aria-label="Trạng thái" value={editStatus} onChange={e => setEditStatus(e.target.value)}>{Object.entries(statusNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Ưu tiên<select aria-label="Ưu tiên" value={editPriority} onChange={e => setEditPriority(e.target.value)}>{Object.entries(priorityNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>}<ErrorNotice message={error} /><div className="dialog-actions"><Button variant="soft" color="gray" onClick={() => setSelected(null)}>Đóng</Button>{user.role === "admin" && <Button disabled={saving} onClick={() => action(async () => { await api("/tickets/" + selected.id, "PATCH", { status: editStatus, priority: editPriority }); setSelected(null); setNotice("Đã cập nhật yêu cầu."); })}>Lưu cập nhật</Button>}</div></>}</Dialog.Content></Dialog.Root>
  </div>;
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><Theme accentColor="teal" grayColor="slate" radius="medium" scaling="100%"><App /></Theme></React.StrictMode>);
