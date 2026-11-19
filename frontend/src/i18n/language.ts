export type Language = "vi" | "en";

export function normalizeLanguage(value: unknown): Language | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "vi" || normalized === "vi-vn") return "vi";
  if (normalized === "en" || normalized === "en-us") return "en";
  return null;
}

function languageCookie(): Language | null {
  if (typeof document === "undefined") return null;
  const entry = document.cookie.split(";").map(value => value.trim()).find(value => value.startsWith("campusdesk_lang="));
  return normalizeLanguage(entry?.slice("campusdesk_lang=".length));
}

export function initialLanguage(): Language {
  if (typeof window !== "undefined") {
    const fromQuery = normalizeLanguage(new URLSearchParams(window.location.search).get("lang"));
    if (fromQuery) return fromQuery;
  }
  return languageCookie() ?? "vi";
}

export function persistLanguage(language: Language): void {
  if (typeof document === "undefined") return;
  document.cookie = `campusdesk_lang=${language}; Path=/; Max-Age=31536000; SameSite=Lax`;
  document.documentElement.lang = language;
}

export function intlLocale(language: Language): string {
  return language === "en" ? "en-US" : "vi-VN";
}
