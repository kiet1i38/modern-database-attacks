import { useEffect, useState } from "react";
import { Badge, Button } from "@radix-ui/themes";
import { scenarios, type DemoScenario } from "./demo-scenarios";

type Outcome = DemoScenario["protected"];
type Engine = "SQL" | "MongoDB";
const authenticationIndex = scenarios.findIndex(scenario => scenario.id === "authentication");

function Records({ rows }: { rows: NonNullable<Outcome["rows"]> }) {
  if (rows.length === 0) return <p className="muted small">Không còn bản ghi.</p>;
  return <div className="table-scroll"><table>
    <thead><tr><th scope="col">Mã mẫu</th><th scope="col">Giá trị</th></tr></thead>
    <tbody>{rows.map(([id, value]) => <tr key={id}><td>{id}</td><td>{value}</td></tr>)}</tbody>
  </table></div>;
}

function Result({ outcome, protectedMode, engine }: { outcome: Outcome; protectedMode: boolean; engine?: Engine }) {
  const title = engine ? `${engine} ${protectedMode ? "Safe" : "Unsafe"}` : protectedMode ? "Có kiểm soát" : "Thiếu kiểm soát";
  return <div className="demo-result">
    <h3>{title}</h3>
    <Badge color={protectedMode ? "teal" : "amber"}>HTTP {outcome.status} minh họa</Badge>
    <p>{outcome.summary}</p>
    {outcome.rows && <Records rows={outcome.rows} />}
  </div>;
}

const checks = [
  ["Quyền đọc yêu cầu", "Mở danh sách yêu cầu bằng tài khoản sinh viên. Danh sách chỉ hiển thị yêu cầu của tài khoản đó. Kiểm thử API xác nhận yêu cầu thuộc sinh viên khác trả HTTP 403."],
  ["Quyền xử lý và chỉnh hồ sơ", "Sửa một yêu cầu bằng tài khoản quản trị và mở lại bằng tài khoản sinh viên sở hữu để thấy trạng thái mới. Kiểm thử API xác nhận sinh viên không thể đổi trạng thái, tạo tài khoản hoặc sửa vai trò qua hồ sơ."],
  ["Phiên và khóa tài khoản", "Mở bản khác để kiểm tra phiên tách riêng. Kiểm thử API xác nhận phiên cũ mất quyền truy cập sau khi đăng xuất hoặc khi tài khoản bị khóa."],
  ["Dữ liệu hợp lệ có dấu nháy", "Lưu một tiêu đề như Yêu cầu của O'Connor rồi mở lại. Kiểm tra tiêu đề vẫn giữ nguyên dấu nháy."]
] as const;

type LiveCheck = { request: string; status: number; expectedStatus: number; result: string };
type SimulationRun = { kind: "simulation"; recordedAt: string; scenario: DemoScenario; engine?: Engine };
type LiveRun = { kind: "live-api"; recordedAt: string; checks: LiveCheck[]; error?: string };

async function checkStudentAccess(userId: string): Promise<LiveCheck[]> {
  const list = await fetch("/api/tickets");
  const items: { id: string; ownerId: string }[] = list.ok ? (await list.json()).items : [];
  const ownOnly = items.every(ticket => ticket.ownerId === userId);
  let listResult = "Không đọc được danh sách.";
  if (list.ok) {
    if (!ownOnly) listResult = "Danh sách chứa yêu cầu không thuộc tài khoản này.";
    else if (items.length === 0) listResult = "Danh sách trên trang đầu không có yêu cầu.";
    else listResult = `Tất cả ${items.length} yêu cầu trên trang đầu thuộc tài khoản này.`;
  }
  const checks: LiveCheck[] = [{
    request: "GET /api/tickets", status: list.status, expectedStatus: 200, result: listResult
  }];
  if (list.ok && ownOnly && items.length > 0) {
    const detail = await fetch("/api/tickets/" + encodeURIComponent(items[0].id));
    checks.push({
      request: "GET /api/tickets/:id", status: detail.status, expectedStatus: 200,
      result: detail.ok ? "Đọc được yêu cầu của chính mình." : "Không đọc được yêu cầu của chính mình."
    });
  }
  const restricted = await fetch("/api/admin/audit");
  let restrictedResult = "Kiểm tra không hoàn tất.";
  if (restricted.status === 403) restrictedResult = "Máy chủ từ chối truy cập nhật ký quản trị.";
  if (restricted.ok) restrictedResult = "Máy chủ đã cho phép truy cập nhật ký quản trị.";
  checks.push({
    request: "GET /api/admin/audit", status: restricted.status, expectedStatus: 403,
    result: restrictedResult
  });
  return checks;
}

export function DemoPanel({ studentId, variant, selectedScenario, presentation = false }: {
  studentId?: string; variant: string; selectedScenario?: DemoScenario; presentation?: boolean;
}) {
  const [scenarioIndex, setScenarioIndex] = useState(presentation ? authenticationIndex : 0);
  const [engine, setEngine] = useState<Engine>("SQL");
  const [showResults, setShowResults] = useState(false);
  const [simulationRuns, setSimulationRuns] = useState<SimulationRun[]>([]);
  const [liveRuns, setLiveRuns] = useState<LiveRun[]>([]);
  const [checking, setChecking] = useState(false);
  const scenario = selectedScenario ?? scenarios[scenarioIndex];
  let defense = scenario.defense;
  if (presentation && scenario.id === "authentication") {
    defense = engine === "SQL"
      ? "Dùng truy vấn tham số hóa để tìm tài khoản, sau đó kiểm tra mật khẩu độc lập."
      : "Kiểm tra tên đăng nhập và mật khẩu đều là chuỗi. Dùng cấu trúc bộ lọc cố định và kiểm tra mật khẩu độc lập.";
  }
  const latestLiveRun = liveRuns[0];
  useEffect(() => setShowResults(false), [selectedScenario]);

  function runComparison() {
    setShowResults(true);
    const run: SimulationRun = { kind: "simulation", recordedAt: new Date().toISOString(), scenario: { ...scenario, defense }, engine: presentation ? engine : undefined };
    setSimulationRuns(previous => [run, ...previous].slice(0, 50));
  }

  async function runLiveChecks() {
    if (!studentId) return;
    setChecking(true);
    const run: LiveRun = { kind: "live-api", recordedAt: new Date().toISOString(), checks: [] };
    try { run.checks = await checkStudentAccess(studentId); }
    catch { run.error = "Không thể hoàn tất kiểm tra. Hãy thử lại."; }
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
    <h2 id="demo-panel-title">Kịch bản bảo mật dữ liệu</h2>
    <p className="muted">Mô phỏng với dữ liệu hư cấu. Các kết quả được soạn sẵn và không gửi yêu cầu đến máy chủ.</p>
    <div className="demo-controls">
      {presentation && <label>Hệ cơ sở dữ liệu
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
      {!selectedScenario && <label>Kịch bản
        <select value={scenarioIndex} onChange={event => {
          const next = Number(event.target.value);
          setScenarioIndex(next);
          if (presentation && scenarios[next].id === "mongo-types") setEngine("MongoDB");
          setShowResults(false);
        }}>
          {scenarios.map((item, index) => <option value={index} key={item.id}>{item.title}</option>)}
        </select>
      </label>}
      <Button onClick={runComparison} disabled={showResults}>So sánh kết quả</Button>
      <Button variant="soft" onClick={() => setShowResults(false)} disabled={!showResults}>Đặt lại mô phỏng</Button>
    </div>
    <div className="demo-request">
      <h3>Yêu cầu minh họa</h3>
      <p>{scenario.request}</p>
      <p className="muted"><strong>Biện pháp bảo vệ.</strong> {defense}</p>
    </div>
    {scenario.before && <div className="demo-before">
      <h3>Dữ liệu ban đầu</h3>
      <Records rows={scenario.before} />
    </div>}
    <div role="status" className="demo-results">
      {showResults && <>
        <Result outcome={scenario.insufficient} protectedMode={false} engine={presentation ? engine : undefined} />
        <Result outcome={scenario.protected} protectedMode engine={presentation ? engine : undefined} />
      </>}
    </div>
    {simulationRuns.length > 0 && <details className="demo-history">
      <summary>Lịch sử mô phỏng trong trang này</summary>
      <ol>{simulationRuns.slice(0, 5).map(({ scenario: item, recordedAt, engine: runEngine }, index) =>
        <li key={recordedAt + index}>{runEngine && `${runEngine} · `}{item.title} · HTTP {item.insufficient.status} / {item.protected.status} minh họa</li>
      )}</ol>
    </details>}
    {!presentation && !selectedScenario && <details className="demo-history">
      <summary>Kiểm tra trên CampusDesk</summary>
      <dl>{checks.map(([title, instruction]) => <div key={title}><dt>{title}</dt><dd>{instruction}</dd></div>)}</dl>
      {studentId && <>
        <Button variant="soft" disabled={checking} onClick={runLiveChecks}>
          {checking ? "Đang kiểm tra…" : "Kiểm tra quyền đọc của sinh viên"}
        </Button>
        {!checking && latestLiveRun?.error && <p role="alert">{latestLiveRun.error}</p>}
        <div aria-live="polite" aria-busy={checking}>
          {!checking && latestLiveRun?.checks.length > 0 && <ul>
            {latestLiveRun.checks.map(check => <li key={check.request}>
              <code>{check.request}</code> · Dự kiến HTTP {check.expectedStatus} · Thực tế HTTP {check.status} · {check.result}
            </li>)}
          </ul>}
        </div>
      </>}
    </details>}
    {(simulationRuns.length > 0 || liveRuns.length > 0) && <div className="demo-history">
      <Button variant="outline" onClick={downloadEvidence}>Tải kết quả JSON</Button>
      <p className="muted small">{presentation
        ? "Lưu tối đa 50 kết quả mô phỏng trong trang hiện tại."
        : "Lưu tối đa 50 lần ở mỗi loại trong trang hiện tại. Tệp phân biệt mô phỏng với kết quả API thực tế."}</p>
    </div>}
  </section>;
}
