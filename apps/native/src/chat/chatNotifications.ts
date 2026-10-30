import { t } from '../i18n';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { notificationId, parseChatNotification, type ChatNotificationTarget } from './notificationTarget';

const COMPLETION_CHANNEL = 'chat-completed';
const MAX_NOTICES = 512;
const delivered = new Set<string>();
let askedPermission = false;
let setup: Promise<void> | undefined;

Notifications.setNotificationHandler({
  handleNotification: async notification => {
    const remote = notification.request.content.data.source === 'chat-push';
    const target = remote ? parseChatNotification(notification.request.content.data) : null;
    const duplicate = !!target && delivered.has(notificationId(target));
    if (target) remember(notificationId(target));
    return { shouldShowBanner: !duplicate, shouldShowList: !duplicate, shouldPlaySound: !duplicate,
      shouldSetBadge: false, priority: Notifications.AndroidNotificationPriority.HIGH };
  },
});
async function prepareChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(COMPLETION_CHANNEL, {
    name: t("client.mobile.chatReplyCompleted"), description: t("client.mobile.notifyWhenCodexFinishesReplyingOnYourComputer"),
    importance: Notifications.AndroidImportance.HIGH, sound: 'default',
    vibrationPattern: [0, 200, 100, 200], lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  });
}
function setupNotifications() {
  setup ??= prepareChannel().catch((error: unknown) => { setup = undefined; throw error; });
  return setup;
}
export async function prepareChatNotifications() {
  await setupNotifications();
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && permission.canAskAgain && !askedPermission && AppState.currentState === 'active') {
    askedPermission = true;
    permission = await Notifications.requestPermissionsAsync();
  }
  return permission.granted || permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

export async function notifyChatCompleted(target: ChatNotificationTarget, title: string, failed: boolean) {
  return notifyChatActivity(target, title, failed ? 'failed' : 'completed');
}
function remember(identifier: string) {
  delivered.add(identifier);
  if (delivered.size > MAX_NOTICES) delivered.delete(delivered.values().next().value!);
}
export async function notifyChatActivity(target: ChatNotificationTarget, title: string,
  kind: 'completed' | 'failed' | 'attention') {
  const identifier = notificationId(target);
  if (delivered.has(identifier)) return;
  remember(identifier);
  try {
    await setupNotifications();
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted && permission.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL) return;
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: { title: kind === 'attention' ? t("client.mobile.codexNeedsYourApproval") : kind === 'failed' ? t("client.mobile.codexCouldNotFinishReplying") : t("client.mobile.codexFinishedReplying"),
        body: title.slice(0, 100) || t("client.mobile.tapToOpenConversation"), data: { ...target }, sound: 'default',
        autoDismiss: true, priority: Notifications.AndroidNotificationPriority.HIGH },
      trigger: Platform.OS === 'android' ? { channelId: COMPLETION_CHANNEL } : null,
    });
  } catch (error) { delivered.delete(identifier); throw error; }
}
