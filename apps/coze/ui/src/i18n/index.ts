/// <reference types="vite/client" />
import { useMemo, useSyncExternalStore } from "react";
import { COZE_DESKTOP_STATE } from "../../../../../shared/coze/desktopBridge";
import {
  deviceLanguage, localeForLanguage,
} from "../../../../../shared/localization/language";
import { createI18n, isAppLanguage, interpolate, type AppLanguage, type MessageKey } from '@remoteai/i18n';
import { resources } from '@remoteai/i18n/coze';
import { createErrorFormatter } from '@remoteai/i18n/errors';
import type { Kind } from "../types";
import { kindCopy, type KindCopy } from "./kinds";

type Language = AppLanguage<'coze'>;
const isLanguage = (value: unknown): value is Language => isAppLanguage('coze', value);
export { isLanguage, kindCopy, localeForLanguage, interpolate };
export type { KindCopy, Language };

export type TranslationValues = Record<string, string | number>;
export type Translate = (key: MessageKey, values?: TranslationValues) => string;
export type Dictionary = Readonly<Record<string, string>>;
type TranslatedLanguage = Exclude<Language, "zh">;

export const LANGUAGE_STORAGE_KEY = "coze-language";

/** Marks application copy that is translated when displayed. */
export function msg<T extends MessageKey>(source: T): T {
  return source;
}

/** Marks a Chinese literal that must stay untranslated (protocol values, classifiers). */
export function verbatim<T extends string>(value: T): T {
  return value;
}

const engine = createI18n({ locale: 'zh', resources });
export const dictionaries = { en: resources.en, ru: resources.ru };
export const formatRemoteError = createErrorFormatter(resources);

export function errorText(error: unknown): string {
  return formatRemoteError(getLanguage(), error);
}
export const displayError = errorText;
export const displayText = (value: string, values?: TranslationValues, language = getLanguage()) =>
  engine.text(value, values, language);

export function translate(language: Language, key: MessageKey, values: TranslationValues = {}): string {
  return engine.text(key, values, language);
}

let current: Language | undefined;
const listeners = new Set<() => void>();

function storedLanguage(): Language | undefined {
  try {
    const value = sessionStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguage(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

/** Current UI language, read lazily so api.ts can store the fragment value first. */
export function getLanguage(): Language {
  current ??= storedLanguage() ?? deviceLanguage();
  return current;
}

export function setLanguage(language: Language): void {
  if (!isLanguage(language)) return;
  try { sessionStorage.setItem(LANGUAGE_STORAGE_KEY, language); } catch { /* storage may be unavailable */ }
  if (typeof document !== "undefined") document.documentElement.lang = localeForLanguage(language);
  if (current === language) return;
  current = language;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useLanguage(): Language {
  return useSyncExternalStore(subscribe, getLanguage, getLanguage);
}

const translators = new Map<Language, Translate>();

function translatorFor(language: Language): Translate {
  let translator = translators.get(language);
  if (!translator) {
    translator = (source, values) => translate(language, source, values);
    translators.set(language, translator);
  }
  return translator;
}

export const t: Translate = (source, values) => translate(getLanguage(), source, values);

export function useT(): Translate {
  const language = useLanguage();
  return useMemo(() => translatorFor(language), [language]);
}

export function useKindCopy(): Readonly<Record<Kind, KindCopy>> {
  return kindCopy[useLanguage()];
}

type DateInput = string | number | Date;

function toDate(value: DateInput): Date | undefined {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Date only; an unparsable value is returned as text. */
export function formatDate(value: DateInput, options?: Intl.DateTimeFormatOptions): string {
  const date = toDate(value);
  return date ? date.toLocaleDateString(localeForLanguage(getLanguage()), options) : String(value);
}

/** Date and time; an unparsable value is returned as text. */
export function formatDateTime(value: DateInput, options?: Intl.DateTimeFormatOptions): string {
  const date = toDate(value);
  return date ? date.toLocaleString(localeForLanguage(getLanguage()), options) : String(value);
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(localeForLanguage(getLanguage()), options).format(value);
}

/** Chinese keeps the `、` separator used before localization; other languages use Intl.ListFormat. */
export function formatList(items: readonly string[], type: "conjunction" | "disjunction" = "conjunction"): string {
  const language = getLanguage();
  if (language === "zh") return items.join("、");
  return new Intl.ListFormat(localeForLanguage(language), { type }).format(items);
}

function receiveDesktopState(event: MessageEvent<unknown>) {
  if (window.parent === window || event.source !== window.parent) return;
  const data = event.data;
  if (typeof data !== "object" || data === null) return;
  // Read the field defensively: older desktop builds send { type, busy } only.
  const state = data as { type?: unknown; language?: unknown };
  if (state.type === COZE_DESKTOP_STATE && isLanguage(state.language)) setLanguage(state.language);
}

if (typeof window !== "undefined") window.addEventListener("message", receiveDesktopState);
