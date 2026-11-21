import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = "evidence/campusdesk-live-demo-2026-11-22";
const readJson = async file => JSON.parse((await readFile(path.join(root, file), "utf8")).replace(/^\uFEFF/, ""));
const readText = file => readFile(path.join(root, file), "utf8");
const browser = await readJson("browser-verified/browser-results.json");
const api = await readJson("api-results.json");
const tests = await readText("test-all.log");
const legacyLog = await readText("legacy-tests.log");
const buildLog = await readText("build-vercel.log");
const auditLog = await readText("audit-production.log");
const units = { total: Number(tests.match(/ℹ tests (\d+)/)?.[1] || 0), passed: Number(tests.match(/ℹ pass (\d+)/)?.[1] || 0), failed: Number(tests.match(/ℹ fail (\d+)/)?.[1] || 0) };
const legacy = { total: Number(legacyLog.match(/ℹ tests (\d+)/)?.[1] || 0), passed: Number(legacyLog.match(/ℹ pass (\d+)/)?.[1] || 0), failed: Number(legacyLog.match(/ℹ fail (\d+)/)?.[1] || 0) };
const auditZero = /found 0 vulnerabilities/.test(auditLog);
const buildSucceeded = /built in /.test(buildLog);
const summary = {
  generatedAt: new Date().toISOString(),
  scope: "Local Docker applications with synthetic database lab data; browser checks ran in Chromium.",
  unit: units,
  integration: { total: api.total, passed: api.passed, failed: api.failed },
  legacy,
  browser: { total: browser.total, passed: browser.passed, failed: browser.failed, screenshots: browser.screenshots.length, runtimeErrors: browser.runtimeErrors.length, consoleErrors: browser.unexpectedConsole.length, networkFailures: browser.networkFailures.length },
  vercelBuild: { passed: buildSucceeded, chunkWarning: /chunks are larger than 500 kB/.test(buildLog) },
  productionDependencyAudit: { zeroVulnerabilities: auditZero },
  limitations: [
    "This report verifies the local Docker stack; it does not claim that the latest source is deployed or the live database lab is enabled on Vercel.",
    "Browser evidence is from Chromium; Firefox and Safari were not run.",
    "The Vercel build passes with the existing Vite advisory that the JavaScript bundle is above 500 kB."
  ],
  files: ["test-all.log", "api-results.json", "api-results.log", "legacy-tests.log", "build-vercel.log", "audit-production.log", "browser-verified/browser-results.json"]
};

const esc = value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const variants = ["sql-unsafe", "sql-safe", "mongo-unsafe", "mongo-safe"];
const matrix = variants.map(variant => {
  const checks = browser.results.filter(result => result.variant === variant);
  const images = browser.screenshots.filter(shot => shot.variant === variant).length;
  return `<tr><td>${esc(variant)}</td><td>${checks.filter(result => result.pass).length}/${checks.length}</td><td>${images}</td></tr>`;
}).join("");
const galleries = variants.map(variant => {
  const shots = browser.screenshots.filter(shot => shot.variant === variant);
  return `<section id="${variant}"><h2>${esc(variant)}</h2><div class="gallery">${shots.map(shot => `<figure><a href="browser-verified/${esc(shot.file)}" target="_blank"><img loading="lazy" src="browser-verified/${esc(shot.file)}" alt="${esc(shot.name)}"></a><figcaption>${esc(shot.name)}</figcaption></figure>`).join("")}</div></section>`;
}).join("");
const checkTable = results => `<details><summary>${results.length} assertions</summary><table><tr><th>Variant</th><th>Check</th><th>Result</th></tr>${results.map(result => `<tr><td>${esc(result.variant || "all")}</td><td>${esc(result.name)}</td><td class="${result.pass ? "pass" : "fail"}">${result.pass ? "PASS" : "FAIL"}${result.error ? ` — ${esc(result.error)}` : ""}</td></tr>`).join("")}</table></details>`;
const logFiles = summary.files.map(file => `<li><a href="${esc(file)}">${esc(file)}</a></li>`).join("");
const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CampusDesk live lab — test evidence</title><style>
body{margin:0;background:#f1f6f4;color:#18352f;font:15px/1.65 system-ui,sans-serif}main{max-width:1200px;margin:auto;padding:32px 22px 60px}h1{font-size:32px;margin:.2em 0}h2{margin-top:42px}a{color:#08785d}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:24px 0}.card{background:white;border:1px solid #dbe7e1;border-radius:10px;padding:16px}.card strong{display:block;font-size:27px}.note{background:#fff2d7;border-radius:8px;padding:14px 18px}nav{display:flex;gap:16px;flex-wrap:wrap;margin:18px 0}table{border-collapse:collapse;width:100%;background:white}td,th{border:1px solid #dbe7e1;padding:10px;text-align:left}details{margin:12px 0;background:white;padding:14px;border-radius:8px}summary{cursor:pointer;font-weight:650}.pass{color:#0b7a58}.fail{color:#b42318}.gallery{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}figure{margin:0;background:white;border:1px solid #dbe7e1;border-radius:8px;overflow:hidden}figure img{display:block;width:100%;height:220px;object-fit:contain;background:#e8efec}figcaption{padding:8px 10px;font-size:12px;overflow-wrap:anywhere}code{background:#e6efea;padding:2px 5px;border-radius:4px}@media(max-width:760px){.cards{grid-template-columns:repeat(2,1fr)}.gallery{grid-template-columns:1fr}}@media print{.gallery{grid-template-columns:repeat(2,1fr)}details{display:block}}
</style></head><body><main><p>MODERN DATABASE ATTACKS · FINAL DEMO EVIDENCE</p><h1>CampusDesk — bằng chứng kiểm thử</h1><p>Generated: ${esc(summary.generatedAt)} · ${esc(summary.scope)}</p><nav>${variants.map(variant => `<a href="#${variant}">${esc(variant)}</a>`).join("")}<a href="verification-summary.json">Summary JSON</a></nav><div class="cards"><div class="card">Unit<strong>${units.passed}/${units.total}</strong></div><div class="card">API integration<strong>${api.passed}/${api.total}</strong></div><div class="card">Legacy<strong>${legacy.passed}/${legacy.total}</strong></div><div class="card">Browser<strong>${browser.passed}/${browser.total}</strong></div></div><p>${browser.screenshots.length} browser screenshots · ${browser.expectedNegativeHttp} expected negative HTTP responses · runtime errors ${browser.runtimeErrors.length} · unexpected console errors ${browser.unexpectedConsole.length} · network failures ${browser.networkFailures.length}</p><table><tr><th>Variant</th><th>Browser checks</th><th>Screenshots</th></tr>${matrix}</table><h2>Build and dependency audit</h2><ul><li>Vercel build: ${buildSucceeded ? "PASS" : "FAIL"}</li><li>Production dependency audit: ${auditZero ? "0 vulnerabilities" : "see log"}</li><li>Bundle warning: ${summary.vercelBuild.chunkWarning ? "JavaScript bundle exceeds 500 kB" : "none"}</li></ul><h2>Limitations</h2><div class="note"><ul>${summary.limitations.map(item => `<li>${esc(item)}</li>`).join("")}</ul></div><h2>Browser assertions</h2>${checkTable(browser.results)}<h2>API integration assertions</h2>${checkTable(api.results)}<h2>Logs and raw results</h2><ul>${logFiles}</ul>${galleries}</main></body></html>`;

await writeFile(path.join(root, "verification-summary.json"), JSON.stringify(summary, null, 2));
await writeFile(path.join(root, "REPORT.html"), html);
console.log(JSON.stringify({ report: path.join(root, "REPORT.html"), unit: summary.unit, integration: summary.integration, legacy: summary.legacy, browser: summary.browser, vercelBuild: summary.vercelBuild, productionDependencyAudit: summary.productionDependencyAudit }));
if (units.failed || legacy.failed || api.failed || browser.failed || !buildSucceeded || !auditZero) process.exitCode = 1;
