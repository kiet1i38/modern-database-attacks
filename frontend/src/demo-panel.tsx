import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Button } from "@radix-ui/themes";
import { scenarios, type DemoScenario } from "./demo-scenarios";
import i18n from "./i18n";

type Outcome = DemoScenario["protected"];
type Engine = "SQL" | "MongoDB";
const authenticationIndex = scenarios.findIndex(scenario => scenario.id === "authentication");
const rowKeys: Record<string, string> = {
  "Nhóm A · Đang mở": "demo.rows.groupAOpen", "Nhóm A · Đã xử lý": "demo.rows.groupAResolved",
  "Nhóm B · Đang mở": "demo.rows.groupBOpen", "Nhóm B · Đang xử lý": "demo.rows.groupBInProgress", "Nhóm B · Đã xử lý": "demo.rows.groupBResolved",
  "Tên cũ · Sinh viên": "demo.rows.oldNameStudent", "Tên mới · Quản trị": "demo.rows.newNameAdmin", "Tên mới · Sinh viên": "demo.rows.newNameStudent",
  "Trường hợp A": "demo.rows.caseA", "Trường hợp B": "demo.rows.caseB", "Có kết quả": "demo.rows.found", "Không có kết quả": "demo.rows.notFound",
  "Đã xử lý yêu cầu": "demo.rows.requestProcessed", "Đổi trạng thái xử lý": "demo.rows.changeStatus", "Tạo tài khoản quản trị": "demo.rows.createAdmin",
  "Đổi vai trò qua hồ sơ": "demo.rows.editRole", "Mở phiên bản khác": "demo.rows.otherVariant", "Sau khi đăng xuất": "demo.rows.afterLogout",
  "Trong lúc tài khoản bị khóa": "demo.rows.accountLocked", "Tiêu đề": "demo.rows.title", "Yêu cầu của O'Connor": "demo.rows.apostropheTitle"
};
function tx(key: string, options?: Record<string, string | number>): string { return String(i18n.t(key, options as never)); }
function localizeRows(rows: NonNullable<Outcome["rows"]> | undefined): NonNullable<Outcome["rows"]> | undefined {
  return rows?.map(([id, value]) => [id, rowKeys[value] ? tx(rowKeys[value], { defaultValue: value }) : value] as const);
}
function localizeScenario(scenario: DemoScenario, defense: string): DemoScenario {
  const key = `demo.scenarios.${scenario.id}`;
  return {
    ...scenario,
    title: tx(`${key}.title`, { defaultValue: scenario.title }),
    request: tx(`${key}.request`, { defaultValue: scenario.request }),
    defense,
    before: localizeRows(scenario.before),
    insufficient: { ...scenario.insufficient, summary: tx(`${key}.unsafe`, { defaultValue: scenario.insufficient.summary }), rows: localizeRows(scenario.insufficient.rows) },
    protected: { ...scenario.protected, summary: tx(`${key}.safe`, { defaultValue: scenario.protected.summary }), rows: localizeRows(scenario.protected.rows) }
  };
}

function Records({ rows }: { rows: NonNullable<Outcome["rows"]> }) {
  if (rows.length === 0) return <p className="muted small">{tx("demo.noRecords")}</p>;
  return <div className="table-scroll"><table>
    <thead><tr><th scope="col">{tx("demo.sampleCode")}</th><th scope="col">{tx("demo.value")}</th></tr></thead>
    <tbody>{rows.map(([id, value]) => <tr key={id}><td>{id}</td><td>{value}</td></tr>)}</tbody>
  </table></div>;
}

function Result({ outcome, protectedMode, engine }: { outcome: Outcome; protectedMode: boolean; engine?: Engine }) {
  const title = engine ? `${tx(engine === "SQL" ? "variant.sql" : "variant.mongo")} ${tx(protectedMode ? "variant.safe" : "variant.unsafe")}` : tx(protectedMode ? "demo.controlled" : "demo.uncontrolled");
  return <div className="demo-result">
    <h3>{title}</h3>
    <Badge color={protectedMode ? "teal" : "amber"}>HTTP {outcome.status} {tx("demo.illustrativeStatus")}</Badge>
    <p>{outcome.summary}</p>
    {outcome.rows && <Records rows={outcome.rows} />}
  </div>;
}

const checks = [
  ["ownership", "demo.checksList.ownership"], ["admin", "demo.checksList.admin"],
  ["session", "demo.checksList.session"], ["apostrophe", "demo.checksList.apostrophe"]
] as const;
type LiveCheck = { request: string; status: number; expectedStatus: number; resultKey: string; count?: number };
type SimulationRun = { kind: "simulation"; recordedAt: string; scenario: DemoScenario; engine?: Engine };
type LiveRun = { kind: "live-api"; recordedAt: string; checks: LiveCheck[]; error?: string };

async function checkStudentAccess(userId: string): Promise<LiveCheck[]> {
  const headers = { "Accept-Language": i18n.resolvedLanguage === "en" ? "en" : "vi" };
  const list = await fetch("/api/tickets", { headers });
  const items: { id: string; ownerId: string }[] = list.ok ? (await list.json()).items : [];
  const ownOnly = items.every(ticket => ticket.ownerId === userId);
  let listResultKey = "demo.notReadable", count = 0;
  if (list.ok) {
    if (!ownOnly) listResultKey = "demo.outOfScopeList";
    else if (items.length === 0) listResultKey = "demo.emptyList";
    else { listResultKey = "demo.ownedList"; count = items.length; }
  }
  const checks: LiveCheck[] = [{
    request: "GET /api/tickets", status: list.status, expectedStatus: 200, resultKey: listResultKey, count
  }];
  if (list.ok && ownOnly && items.length > 0) {
    const detail = await fetch("/api/tickets/" + encodeURIComponent(items[0].id), { headers });
    checks.push({
      request: "GET /api/tickets/:id", status: detail.status, expectedStatus: 200,
      resultKey: detail.ok ? "demo.readOwn" : "demo.cannotReadOwn"
    });
  }
  const restricted = await fetch("/api/admin/audit", { headers });
  let restrictedResultKey = "demo.checkIncomplete";
  if (restricted.status === 403) restrictedResultKey = "demo.adminDenied";
  if (restricted.ok) restrictedResultKey = "demo.adminAllowed";
  checks.push({
    request: "GET /api/admin/audit", status: restricted.status, expectedStatus: 403,
    resultKey: restrictedResultKey
  });
  return checks;
}

export function DemoPanel({ studentId, variant, selectedScenario, presentation = false }: {
  studentId?: string; variant: string; selectedScenario?: DemoScenario; presentation?: boolean;
}) {
  useTranslation();
  const [scenarioIndex, setScenarioIndex] = useState(presentation ? authenticationIndex : 0);
  const [engine, setEngine] = useState<Engine>("SQL");
  const [showResults, setShowResults] = useState(false);
  const [simulationRuns, setSimulationRuns] = useState<SimulationRun[]>([]);
  const [liveRuns, setLiveRuns] = useState<LiveRun[]>([]);
  const [checking, setChecking] = useState(false);
  const sourceScenario = selectedScenario ?? scenarios[scenarioIndex];
  const defenseKey = presentation && sourceScenario.id === "authentication"
    ? engine === "SQL" ? "demo.sqlDefense" : "demo.mongoDefense"
    : `demo.scenarios.${sourceScenario.id}.defense`;
  const scenario = localizeScenario(sourceScenario, tx(defenseKey, { defaultValue: sourceScenario.defense }));
  const latestLiveRun = liveRuns[0];
  useEffect(() => setShowResults(false), [selectedScenario]);

  function runComparison() {
    setShowResults(true);
    const run: SimulationRun = { kind: "simulation", recordedAt: new Date().toISOString(), scenario: sourceScenario, engine: presentation ? engine : undefined };
    setSimulationRuns(previous => [run, ...previous].slice(0, 50));
  }

  async function runLiveChecks() {
    if (!studentId) return;
    setChecking(true);
    const run: LiveRun = { kind: "live-api", recordedAt: new Date().toISOString(), checks: [] };
    try { run.checks = await checkStudentAccess(studentId); }
    catch { run.error = "demo.liveFailure"; }
    setLiveRuns(previous => [run, ...previous].slice(0, 50));
    setChecking(false);
  }

  function downloadEvidence() {
    const evidence = { variant, exportedAt: new Date().toISOString(), simulationRuns, liveRuns };
    const file = new Blob([JSON.stringify(evidence, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = "campusdesk-demo-evidence.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <section className="panel lab-overview demo-panel" aria-labelledby="demo-panel-title">
    <h2 id="demo-panel-title">{tx("demo.title")}</h2>
    <p className="muted">{tx("demo.description")}</p>
    <div className="demo-controls">
      {presentation && <label>{tx("demo.engine")}
        <select value={engine} onChange={event => {
          const next = event.target.value === "MongoDB" ? "MongoDB" : "SQL";
          setEngine(next);
          if (next === "SQL" && scenario.id === "mongo-types") setScenarioIndex(authenticationIndex);
          setShowResults(false);
        }}>
          <option>SQL</option>
          <option>MongoDB</option>
        </select>
      </label>}
      {!selectedScenario && <label>{tx("demo.scenario")}
        <select value={scenarioIndex} onChange={event => {
          const next = Number(event.target.value);
          setScenarioIndex(next);
          if (presentation && scenarios[next].id === "mongo-types") setEngine("MongoDB");
          setShowResults(false);
        }}>
          {scenarios.map((item, index) => <option value={index} key={item.id}>{tx(`demo.scenarios.${item.id}.title`, { defaultValue: item.title })}</option>)}
        </select>
      </label>}
      <Button onClick={runComparison} disabled={showResults}>{tx("demo.compare")}</Button>
      <Button variant="soft" onClick={() => setShowResults(false)} disabled={!showResults}>{tx("demo.reset")}</Button>
    </div>
    <div className="demo-request">
      <h3>{tx("demo.request")}</h3>
      <p>{scenario.request}</p>
      <p className="muted"><strong>{tx("demo.defense")}</strong> {scenario.defense}</p>
    </div>
    {scenario.before && <div className="demo-before">
      <h3>{tx("demo.before")}</h3>
      <Records rows={scenario.before} />
    </div>}
    <div role="status" className="demo-results">
      {showResults && <>
        <Result outcome={scenario.insufficient} protectedMode={false} engine={presentation ? engine : undefined} />
        <Result outcome={scenario.protected} protectedMode engine={presentation ? engine : undefined} />
      </>}
    </div>
    {simulationRuns.length > 0 && <details className="demo-history">
      <summary>{tx("demo.history")}</summary>
      <ol>{simulationRuns.slice(0, 5).map(({ scenario: item, recordedAt, engine: runEngine }, index) =>
        <li key={recordedAt + index}>{runEngine && `${runEngine} · `}{tx(`demo.scenarios.${item.id}.title`, { defaultValue: item.title })} · HTTP {item.insufficient.status} / {item.protected.status} {tx("demo.illustrativeStatus")}</li>
      )}</ol>
    </details>}
    {!presentation && !selectedScenario && <details className="demo-history">
      <summary>{tx("demo.checks")}</summary>
      <dl>{checks.map(([id, key]) => <div key={id}><dt>{tx(`${key}.title`)}</dt><dd>{tx(`${key}.instruction`)}</dd></div>)}</dl>
      {studentId && <>
        <Button variant="soft" disabled={checking} onClick={runLiveChecks}>
          {checking ? tx("demo.checking") : tx("demo.runCheck")}
        </Button>
        {!checking && latestLiveRun?.error && <p role="alert">{tx(latestLiveRun.error)}</p>}
        <div aria-live="polite" aria-busy={checking}>
          {!checking && latestLiveRun?.checks.length > 0 && <ul>
            {latestLiveRun.checks.map(check => <li key={check.request}>
              <code>{check.request}</code> · {tx("demo.expectedActual", { expected: check.expectedStatus, actual: check.status, result: tx(check.resultKey, check.count === undefined ? undefined : { count: check.count }) })}
            </li>)}
          </ul>}
        </div>
      </>}
    </details>}
    {(simulationRuns.length > 0 || liveRuns.length > 0) && <div className="demo-history">
      <Button variant="outline" onClick={downloadEvidence}>{tx("demo.download")}</Button>
      <p className="muted small">{tx(presentation ? "demo.maxPresentation" : "demo.maxHistory")}</p>
    </div>}
  </section>;
}
