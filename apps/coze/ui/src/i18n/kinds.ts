import kindCopyResource from '@remoteai/i18n/copy/coze/kinds';
import type { AppLanguage } from '@remoteai/i18n';
import type { Kind } from "../types";
type Language = AppLanguage<'coze'>;

/**
 * Resource kind names in every UI language.
 *
 * Chinese uses one word for a kind everywhere, so the Chinese strings below are
 * exactly the labels and concatenations the studio rendered before localization.
 * English and Russian need a plural heading, a singular tag and full phrases with
 * the right gender and case, so each kind carries complete strings:
 * - section: navigation item and list heading ("Agents", "Агенты");
 * - item: tag or option prefix for one resource ("Agent", "Агент");
 * - create: "new" button, menu item and dialog title;
 * - empty: empty list text;
 * - first: button that creates the first resource of the kind.
 *
 * This module is plain data. types.ts imports it, and Playwright specs import
 * types.ts outside Vite, so it must not import ./index.
 */
export interface KindCopy {
  section: string;
  item: string;
  create: string;
  empty: string;
  first: string;
}

export const kindCopy: Readonly<Record<Language, Readonly<Record<Kind, KindCopy>>>> = kindCopyResource;
