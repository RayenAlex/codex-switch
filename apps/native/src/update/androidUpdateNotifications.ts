import { AppState } from 'react-native';
import { t } from '../i18n';

const UPDATE_CHANNEL = 'app-update-download';
let askedPermission = false;

export function updateNotificationLabels() {
  return { channel: t("client.downloads.appUpdates"), verifying: t("client.downloads.verifying"),
    ready: t("client.downloads.updateDownloadedTapToOpenTheAppAndInstall"), failed: t("client.downloads.downloadIncompleteTapToOpenTheAppAndRetry") };
}

/** Only a manual update asks for permission; background preparation never opens a prompt. */
export async function prepareUpdateNotifications() {
  try {
    const notifications = await import('expo-notifications');
    await notifications.setNotificationChannelAsync(UPDATE_CHANNEL, {
      name: t("client.downloads.appUpdates"), importance: notifications.AndroidImportance.LOW,
      showBadge: false, sound: null,
    });
    const permission = await notifications.getPermissionsAsync();
    if (permission.granted || !permission.canAskAgain || askedPermission || AppState.currentState !== 'active') return;
    askedPermission = true;
    await notifications.requestPermissionsAsync();
  } catch (error) {
    // The in-app progress remains usable when notifications are unavailable.
    console.warn('Unable to enable update notifications', error);
  }
}
