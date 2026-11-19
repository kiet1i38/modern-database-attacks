import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MONGO_PAYLOADS, SQL_PAYLOADS } from "../src/campus/domain.js";
import { apiMessageKeys } from "../src/campus/i18n/messages.js";

function strictJson(source, file) {
  let index = 0;
  const fail = message => { throw new Error(`${file}: ${message} at character ${index + 1}`); };
  const whitespace = () => { while (/\s/.test(source[index] || "")) index++; };
  const string = () => {
    const start = index;
    if (source[index++] !== '"') fail("Expected a JSON string");
    while (index < source.length) {
      if (source[index] === "\\") { index += 2; continue; }
      if (source[index++] === '"') return JSON.parse(source.slice(start, index));
    }
    fail("Unterminated JSON string");
  };
  const value = () => {
    whitespace();
    if (source[index] === '"') return string();
    if (source[index] === "{") {
      index++;
      const object = {}, keys = new Set();
      whitespace();
      if (source[index] === "}") { index++; return object; }
      while (index < source.length) {
        whitespace();
        const key = string();
        if (keys.has(key)) fail(`Duplicate object key ${JSON.stringify(key)}`);
        keys.add(key);
        whitespace();
        if (source[index++] !== ":") fail("Expected ':' after object key");
        object[key] = value();
        whitespace();
        if (source[index] === "}") { index++; return object; }
        if (source[index++] !== ",") fail("Expected ',' or '}'");
      }
      fail("Unterminated object");
    }
    if (source[index] === "[") {
      index++;
      const array = [];
      whitespace();
      if (source[index] === "]") { index++; return array; }
      while (index < source.length) {
        array.push(value());
        whitespace();
        if (source[index] === "]") { index++; return array; }
        if (source[index++] !== ",") fail("Expected ',' or ']'");
      }
      fail("Unterminated array");
    }
    const start = index;
    while (index < source.length && !/[\s,}\]]/.test(source[index])) index++;
    if (start === index) fail("Expected a JSON value");
    try { return JSON.parse(source.slice(start, index)); }
    catch { fail("Invalid JSON value"); }
  };
  const parsed = value();
  whitespace();
  if (index !== source.length) fail("Unexpected trailing input");
  return parsed;
}

function flatten(value, prefix = "", output = {}) {
  for (const [key, child] of Object.entries(value)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child)) flatten(child, full, output);
    else output[full] = child;
  }
  return output;
}

const vi = flatten(strictJson(readFileSync(new URL("../frontend/src/i18n/locales/vi.json", import.meta.url), "utf8"), "vi.json"));
const en = flatten(strictJson(readFileSync(new URL("../frontend/src/i18n/locales/en.json", import.meta.url), "utf8"), "en.json"));
const keysVi = Object.keys(vi).sort(), keysEn = Object.keys(en).sort();
assert.deepEqual(keysVi, keysEn, "Vietnamese and English dictionaries must have identical keys");
for (const key of keysVi) {
  assert.equal(typeof vi[key], "string", `${key} must be a string`);
  assert.ok(vi[key].trim(), `${key} must not be empty`);
  assert.ok(en[key].trim(), `${key} must not be empty`);
  const placeholders = value => [...value.matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g)].map(match => match[1]).sort();
  assert.deepEqual(placeholders(vi[key]), placeholders(en[key]), `${key} placeholders must match`);
}
for (const key of apiMessageKeys) assert.ok(vi[key] && en[key], `Frontend dictionaries must include backend message key ${key}`);

for (const file of ["../frontend/src/main.tsx", "../frontend/src/demo-panel.tsx"]) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  for (const [, key] of source.matchAll(/\btx\(\s*["']([^"']+)["']/g)) {
    assert.ok(vi[key] && en[key], `${file} refers to missing translation key ${key}`);
  }
  if (file.endsWith("demo-panel.tsx")) {
    for (const [, key] of source.matchAll(/:\s*"(demo\.rows\.[^"]+)"/g)) assert.ok(vi[key] && en[key], `Missing demo row translation ${key}`);
  }
}
const scenarioSource = readFileSync(new URL("../frontend/src/demo-scenarios.ts", import.meta.url), "utf8");
for (const [, id] of scenarioSource.matchAll(/\bid:\s*"([a-z0-9-]+)"/g)) {
  for (const field of ["title", "request", "defense", "unsafe", "safe"]) {
    assert.ok(vi[`demo.scenarios.${id}.${field}`] && en[`demo.scenarios.${id}.${field}`], `Missing scenario text for ${id}.${field}`);
  }
}

for (const value of ["open", "in_progress", "resolved"]) assert.ok(vi[`status.${value}`] && en[`status.${value}`]);
for (const value of ["low", "medium", "high"]) assert.ok(vi[`priority.${value}`] && en[`priority.${value}`]);
for (const value of ["academic", "it", "facilities", "other"]) assert.ok(vi[`category.${value}`] && en[`category.${value}`]);
for (const value of ["admin", "user"]) assert.ok(vi[`roles.${value}`] && en[`roles.${value}`]);
for (const value of ["overview", "tickets", "users", "profile", "lab"]) assert.ok(vi[`navigation.${value}`] && en[`navigation.${value}`]);
for (const value of ["safe", "unsafe", "sql", "mongo"]) assert.ok(vi[`variant.${value}`] && en[`variant.${value}`]);
for (const value of ["normal", "operatorInput", "invalidInput", "malformedSql"]) assert.ok(vi[`audit.${value}`] && en[`audit.${value}`], `Missing audit label: ${value}`);
const mainSource = readFileSync(new URL("../frontend/src/main.tsx", import.meta.url), "utf8");
assert.match(mainSource, /tx\(pages\[item\]\)/, "Dynamic navigation labels must be translated");
assert.match(mainSource, /localizedPayload\(config, e\.payload\)/, "Audit payload IDs must be localized in the UI");
for (const payload of SQL_PAYLOADS) assert.ok(vi[`lab.payloads.sql.${payload.id}`] && en[`lab.payloads.sql.${payload.id}`], `Missing SQL payload label: ${payload.id}`);
for (const payload of MONGO_PAYLOADS) assert.ok(vi[`lab.payloads.mongo.${payload.id}`] && en[`lab.payloads.mongo.${payload.id}`], `Missing MongoDB payload label: ${payload.id}`);

console.log(`i18n dictionaries valid: ${keysVi.length} matching keys; locale placeholders and enums checked; ${SQL_PAYLOADS.length} SQL + ${MONGO_PAYLOADS.length} MongoDB payload labels present.`);
