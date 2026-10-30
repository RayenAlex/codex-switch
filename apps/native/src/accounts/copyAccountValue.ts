import { t } from '../i18n';
import * as Clipboard from 'expo-clipboard';
import { Toast } from '../components/AppToast';

export async function copyAccountValue(label: string, value: string) {
  if (!value) return;
  try {
    await Clipboard.setStringAsync(value);
    Toast.success(t("client.mobile.copied", { value1: label }));
  } catch {
    Toast.fail(t("client.app.couldNotCopyPleaseTryAgain"));
  }
}
