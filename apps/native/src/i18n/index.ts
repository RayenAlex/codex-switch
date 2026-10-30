import { applications, languageOptions, type AppLanguage } from '@remoteai/i18n';
import { useSyncExternalStore } from 'react';
import { getInterfaceLanguage, subscribeInterfaceLanguage } from "../../../../shared/localization/interfaceLanguage";
import { localeForLanguage } from "../../../../shared/localization/language";
import { translateMessage, type MessageKey, type TranslationValues } from "../../../../shared/localization/messages";

export const LANGUAGE_OPTIONS = languageOptions(applications.native);
export { languageLabel } from '@remoteai/i18n';
export type Language = AppLanguage<'native'>;
export { displayText } from '../../../../shared/localization/messages';
export { remoteErrorText as displayError } from '../../../../shared/localization/errors';
export const getLanguage = getInterfaceLanguage;
export const getLocale = () => localeForLanguage(getLanguage());
export const t = (key: MessageKey, values?: TranslationValues) => translateMessage(getLanguage(), key, values);
export const useLanguage = () => useSyncExternalStore(subscribeInterfaceLanguage, getLanguage, () => 'zh' as const);
