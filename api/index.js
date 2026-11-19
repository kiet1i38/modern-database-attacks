import { createHostedHandler } from "../src/campus/hosted.js";

const handleHosted = createHostedHandler();

export function restoreVercelApiPath(req) {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname !== "/api/index" || !url.searchParams.has("__route")) return true;
  const route = url.searchParams.get("__route");
  url.searchParams.delete("__route");
  if (!route || route.startsWith("/") || route.split("/").some(part => part === "." || part === "..")) return false;
  req.url = "/api/" + route + url.search;
  return true;
}

export default function handler(req, res) {
  if (!restoreVercelApiPath(req)) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, code: "INVALID_ROUTE" }));
    return;
  }
  return handleHosted(req, res);
}
