import { applications, languageOptions, isAppLanguage } from '@remoteai/i18n';
import zhResource from '@remoteai/i18n/copy/admin/zh';
import enResource from '@remoteai/i18n/copy/admin/en';
import { ru } from "./i18n-ru";

export const LANGUAGE_STORAGE_KEY = "codex-switch-admin-language";

export const LANGUAGE_OPTIONS = languageOptions(applications.admin, true);

export type Language = (typeof LANGUAGE_OPTIONS)[number]["value"];

export const DEFAULT_LANGUAGE: Language = "zh";

const en = enResource;

type TranslationKey = keyof typeof en;

const zh: Record<TranslationKey, string> = zhResource;

const translations: Record<Language, Partial<Record<TranslationKey, string>>> = { en, zh, ru };

// ru is a partial dictionary (public auth pages and the self-service shell);
// missing keys fall back to English before the Chinese default.
const fallbackLanguages: Record<Language, readonly Language[]> = {
  zh: ["zh"],
  en: ["en", DEFAULT_LANGUAGE],
  ru: ["ru", "en", DEFAULT_LANGUAGE],
};

export type { TranslationKey };
export type TranslationValues = Record<string, string | number>;
export type Translate = (key: TranslationKey, values?: TranslationValues) => string;

export function isLanguage(value: unknown): value is Language {
  return isAppLanguage('admin', value);
}

export function translate(language: Language, key: TranslationKey, values: TranslationValues = {}) {
  let text = key as string;
  for (const candidate of fallbackLanguages[language]) {
    const value = translations[candidate][key];
    if (value !== undefined) {
      text = value;
      break;
    }
  }
  for (const [name, value] of Object.entries(values)) {
    text = text.split(`{${name}}`).join(String(value));
  }
  return text;
}

export function hasTranslation(key: string): key is TranslationKey {
  return key in en;
}

export function labelForRole(role: string, t: Translate) {
  if (role === "admin") return t("role.admin");
  if (role === "user") return t("role.user");
  return role;
}
