import { NativeModules } from 'react-native';
import { subscribeInterfaceLanguage } from "../../../../shared/localization/interfaceLanguage";
import { t } from '../i18n';

export interface SelectionLabels { copy: string; selectAll: string; quote: string }

interface SelectionBridge {
  longPressTimeoutMs?: number;
  configure: (tag: number, enabled: boolean, trailingControls: number) => void;
  /** Missing in older native builds, which keep their built-in Chinese toolbar titles. */
  setLabels?: (labels: SelectionLabels) => void;
  detach: (tag: number) => void;
  dismiss: () => void;
}

export const nativeTextSelection = NativeModules.ChatTextSelection as SelectionBridge | undefined;

export const selectionLabels = (): SelectionLabels => ({ copy: t("client.projectBrowser.copied"), selectAll: t("client.projectBrowser.selectAll"), quote: t("client.chat.quote") });

/** The Android selection toolbar is native, so it receives its titles again after each language change. */
export function syncSelectionLabels(bridge: SelectionBridge | undefined = nativeTextSelection): () => void {
  if (typeof bridge?.setLabels !== 'function') return () => undefined;
  const update = () => bridge.setLabels?.(selectionLabels());
  update();
  return subscribeInterfaceLanguage(update);
}

syncSelectionLabels();
