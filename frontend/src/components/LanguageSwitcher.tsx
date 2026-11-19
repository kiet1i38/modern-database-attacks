import { useTranslation } from "react-i18next";
import type { Language } from "../i18n/language";

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const language: Language = i18n.resolvedLanguage === "en" ? "en" : "vi";
  return <label className="language-switcher">
    <span className="sr-only">{t("language.select")}</span>
    <select aria-label={t("language.select")} value={language} onChange={event => {
      const next = event.target.value as Language;
      const address = new URL(window.location.href);
      address.searchParams.set("lang", next);
      window.history.replaceState({}, "", `${address.pathname}${address.search}${address.hash}`);
      void i18n.changeLanguage(next);
    }}>
      <option value="vi">{t("language.vietnamese")}</option>
      <option value="en">{t("language.english")}</option>
    </select>
  </label>;
}
