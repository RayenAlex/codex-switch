import ruResource from '@remoteai/i18n/copy/admin/ru';
import type { TranslationKey } from "./i18n";

// Partial Russian dictionary: public auth pages (sign-in, invited registration,
// password reset) and the self-service shell (header, My Accounts, profile,
// password). Missing keys fall back to English in translate(), so operator
// pages stay in English under ru.
export const ru: Partial<Record<TranslationKey, string>> = ruResource;
