import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";

export const SUPPORTED_LOCALES = ["en"] as const;

const browser = typeof navigator !== "undefined" ? navigator.language.split("-")[0] : undefined;
const fallback = (import.meta.env.VITE_DEFAULT_LOCALE as string | undefined) ?? "en";
const lng = SUPPORTED_LOCALES.includes(browser as (typeof SUPPORTED_LOCALES)[number]) ? browser! : fallback;

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  returnNull: false,
});

document.documentElement.lang = lng;

export default i18n;
