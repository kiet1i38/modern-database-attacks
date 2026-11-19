export function resolveLocale(header) {
  if (typeof header !== "string" || header.length > 256) return "vi";
  for (const item of header.split(",")) {
    const [rawTag, ...options] = item.trim().split(";");
    const tag = rawTag.trim().toLowerCase();
    const q = options.map(value => /^q\s*=\s*(.+)$/i.exec(value.trim())?.[1]).find(Boolean);
    if (q !== undefined && (!Number.isFinite(Number(q)) || Number(q) <= 0)) continue;
    if (tag === "en" || tag === "en-us") return "en";
    if (tag === "vi" || tag === "vi-vn") return "vi";
  }
  return "vi";
}
