import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Button, Callout, Select, TextField } from "@radix-ui/themes";
import { ArrowClockwise, Database, Flask, Trash } from "@phosphor-icons/react";

export type LabKind = "sql" | "mongo";
type Api = <T>(url: string, method?: string, body?: unknown) => Promise<T>;
type LabState = {
  kind: LabKind;
  database: string;
  eventsTableExists?: boolean;
  events?: { id: string; owner: string; note: string }[];
  collection?: string;
  notes?: { id: string; owner: string; body: string }[];
};
type LoginResult = { mode: string; matched: boolean; blocked?: boolean; user?: { username: string; role: string } | null; query: string };
function errorMessage(error: unknown, t: (key: string) => string) {
  const value = error as { messageKey?: string; message?: string };
  return value?.messageKey ? t(value.messageKey) : value?.message || t("live.error");
}

export function LiveLabPanel({ kind, api }: { kind: LabKind; api: Api }) {
  const { t } = useTranslation();
  const [state, setState] = useState<LabState | null>(null);
  const [mode, setMode] = useState("unsafe");
  const [deleteMode, setDeleteMode] = useState("unsafe");
  const [username, setUsername] = useState("labadmin");
  const [password, setPassword] = useState("");
  const [owner, setOwner] = useState("");
  const [loginResult, setLoginResult] = useState<LoginResult | null>(null);
  const [deleteResult, setDeleteResult] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const next = await api<LabState>("/live-lab/state");
    setState(next);
  }
  useEffect(() => { void refresh().catch(e => setError(errorMessage(e, t))); }, []);

  async function runLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setLoginResult(null);
    try {
      let submittedPassword: unknown = password;
      if (kind === "mongo" && mode === "unsafe") {
        try { submittedPassword = JSON.parse(password); } catch { /* plain demo password */ }
      }
      const result = await api<LoginResult>("/live-lab/login", "POST", { mode, username, password: submittedPassword });
      setLoginResult(result);
      await refresh();
    } catch (e) { setError(errorMessage(e, t)); }
    finally { setBusy(false); }
  }

  async function runDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setDeleteResult(null);
    try {
      let submittedOwner: unknown = owner;
      if (deleteMode === "unsafe") {
        try { submittedOwner = JSON.parse(owner); } catch { /* plain owner name */ }
      }
      const result = await api<{ deletedCount: number; blocked?: boolean }>("/live-lab/delete", "POST", { mode: deleteMode, owner: submittedOwner });
      setDeleteResult(result.deletedCount);
      await refresh();
    } catch (e) { setError(errorMessage(e, t)); }
    finally { setBusy(false); }
  }

  async function reset() {
    if (!window.confirm(t("live.resetConfirm"))) return;
    setBusy(true); setError(""); setLoginResult(null); setDeleteResult(null);
    try {
      const result = await api<LabState>("/live-lab/reset", "POST", {});
      setState(result);
    } catch (e) { setError(errorMessage(e, t)); }
    finally { setBusy(false); }
  }

  const records = kind === "sql" ? state?.events || [] : state?.notes || [];
  return <section className="panel live-lab" aria-labelledby="live-lab-title">
    <div className="live-lab-heading">
      <div>
        <div className="section-label"><Flask size={17} />{t("live.eyebrow")}</div>
        <h2 id="live-lab-title">{t(kind === "sql" ? "live.sqlTitle" : "live.mongoTitle")}</h2>
        <p>{t("live.description")}</p>
      </div>
      <Button variant="soft" color="gray" disabled={busy} onClick={() => void reset()}><ArrowClockwise size={17} />{t("live.reset")}</Button>
    </div>
    <Callout.Root color="amber"><Callout.Text>{t("live.isolation")}</Callout.Text></Callout.Root>
    <div className="live-lab-meta"><Badge color="blue"><Database size={14} />{state?.database || t("live.loading")}</Badge><span>{t("live.accountHint")}: <code>labadmin / Lab@123</code></span></div>
    {error && <Callout.Root color="red" role="alert"><Callout.Text>{error}</Callout.Text></Callout.Root>}
    <div className="live-lab-grid">
      <form className="live-lab-card stack" onSubmit={runLogin}>
        <h3>{t("live.authTitle")}</h3>
        <label>{t("live.mode")}<Select.Root value={mode} onValueChange={setMode}><Select.Trigger aria-label={t("live.mode")} /><Select.Content><Select.Item value="unsafe">{t("live.unsafeMode")}</Select.Item><Select.Item value="safe">{t("live.safeMode")}</Select.Item></Select.Content></Select.Root></label>
        <label>{t("live.username")}<TextField.Root value={username} onChange={e => setUsername(e.target.value)} required /></label>
        <label>{t("live.password")}<TextField.Root value={password} onChange={e => setPassword(e.target.value)} placeholder={kind === "sql" ? t("live.sqlPayloadHint") : t("live.mongoLoginHint")} /></label>
        <p className="form-note">{t(kind === "sql" ? "live.sqlHelp" : "live.mongoHelp")}</p>
        <Button type="submit" disabled={busy}>{t("live.runLogin")}</Button>
        {loginResult && <div className="live-lab-result" role="status"><Badge color={loginResult.matched ? "amber" : "teal"}>{loginResult.matched ? t("live.authPassed") : loginResult.blocked ? t("live.inputBlocked") : t("live.authDenied")}</Badge>{loginResult.user && <p>{loginResult.user.username} · {loginResult.user.role}</p>}<pre>{loginResult.query}</pre></div>}
      </form>
      {kind === "mongo" ? <form className="live-lab-card stack" onSubmit={runDelete}>
        <h3>{t("live.deleteTitle")}</h3>
        <label>{t("live.mode")}<Select.Root value={deleteMode} onValueChange={setDeleteMode}><Select.Trigger aria-label={t("live.deleteMode")} /><Select.Content><Select.Item value="unsafe">{t("live.unsafeMode")}</Select.Item><Select.Item value="safe">{t("live.safeMode")}</Select.Item></Select.Content></Select.Root></label>
        <label>{t("live.ownerFilter")}<TextField.Root value={owner} onChange={e => setOwner(e.target.value)} placeholder={deleteMode === "unsafe" ? t("live.mongoDeleteHint") : "alice"} required /></label>
        <p className="form-note">{t("live.mongoDeleteHelp")}</p>
        <Button type="submit" color="red" disabled={busy}><Trash size={17} />{t("live.runDelete")}</Button>
        {deleteResult !== null && <Badge color={deleteResult ? "amber" : "teal"}>{t("live.deletedCount", { count: deleteResult })}</Badge>}
      </form> : <section className="live-lab-card stack" aria-label={t("live.sqlTarget")}>
        <h3>{t("live.sqlTarget")}</h3>
        <p>{t("live.sqlTargetHelp")}</p>
        <code>lab_events</code>
      </section>}
    </div>
    <section className="live-lab-records">
      <div className="panel-head"><div><h3>{kind === "sql" ? t("live.sqlRows") : t("live.mongoRows")}</h3><p>{t("live.refreshAfterAction")}</p></div><Badge color={state?.eventsTableExists === false ? "red" : "gray"}>{state?.eventsTableExists === false ? t("live.tableMissing") : t("live.recordCount", { count: records.length })}</Badge></div>
      {state?.eventsTableExists === false ? <Callout.Root color="red"><Callout.Text>{t("live.droppedTable")}</Callout.Text></Callout.Root> : records.length ? <div className="table-scroll"><table><thead><tr>{[t("live.id"), t("live.owner"), t("live.note")].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{records.map(row => <tr key={row.id}><td>{row.id}</td><td>{row.owner}</td><td>{kind === "sql" ? (row as { note: string }).note : (row as { body: string }).body}</td></tr>)}</tbody></table></div> : <p className="muted">{t("live.noRecords")}</p>}
    </section>
  </section>;
}
