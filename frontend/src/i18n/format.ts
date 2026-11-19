import type { Language } from "./language";
import { intlLocale } from "./language";

export function formatDate(value: number | string | Date, language: Language): string {
  return new Intl.DateTimeFormat(intlLocale(language), { dateStyle: "medium" }).format(new Date(value));
}

export function formatDateTime(value: number | string | Date, language: Language): string {
  return new Intl.DateTimeFormat(intlLocale(language), { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function formatNumber(value: number, language: Language): string {
  return new Intl.NumberFormat(intlLocale(language)).format(value);
}
