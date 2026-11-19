import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import vi from "./locales/vi.json";
import { initialLanguage, persistLanguage, type Language } from "./language";

const language = initialLanguage();

void i18n.use(initReactI18next).init({
  resources: { vi: { translation: vi }, en: { translation: en } },
  lng: language,
  fallbackLng: "vi",
  supportedLngs: ["vi", "en"],
  interpolation: { escapeValue: false },
  returnNull: false,
  returnEmptyString: false
});

persistLanguage(language);
i18n.on("languageChanged", value => {
  const supported = value as Language;
  if (supported === "vi" || supported === "en") persistLanguage(supported);
});

export default i18n;
