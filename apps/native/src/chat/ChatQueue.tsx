import { displayError } from '../i18n/index';
import { createThemedStyles } from '../theme/styles';
import { useThemeColor } from '../theme/store';
import { t, useLanguage } from '../i18n';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { QueueProps } from '../../../../shared/remote-chat/client/queueProps';
import { palette, useStyles } from './styles';
import Feather from '@expo/vector-icons/Feather';
import { useQueueSelection } from '../../../../shared/remote-chat/client/useQueueSelection';

type Props = QueueProps & { edit: (id: string) => Promise<void>; editDisabled: boolean };

export function ChatQueue({ messages, running, disabled, act, edit, editDisabled }: Props) {
  const queueStyles = useQueueStyles();
  const styles = useStyles();
  const color = useThemeColor();
  useLanguage();
  const { selected, select, canMoveUp, canMoveDown } = useQueueSelection(messages, disabled);
  if (!messages.length) return null;
  const sending = messages.some((message) => message.busy);
  return <View style={queueStyles.queue} accessibilityLabel={t("client.chat.queuedMessages")}>
    <View style={queueStyles.heading}><Text style={styles.subtitle}>{t("client.chat.queued")}{' '}{messages.length}</Text>
      <View style={queueStyles.actions}>
      {!running && <Pressable accessibilityRole="button" disabled={disabled || sending}
        style={queueStyles.action} onPress={() => void act('queueFlush')}>
        <Text style={[styles.buttonText, (disabled || sending) && styles.disabled]}>{t("client.chat.sendAll")}</Text>
      </Pressable>}
      <Pressable accessibilityRole="button" accessibilityLabel={t("client.chat.moveQueuedMessageUp")} disabled={!canMoveUp}
        style={[queueStyles.action, !canMoveUp && styles.disabled]}
        onPress={() => void act('queueMoveUp', selected.id)}>
        <Feather name="arrow-up" size={17} color={color(palette.muted, 'muted')} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t("client.chat.moveQueuedMessageDown")} disabled={!canMoveDown}
        style={[queueStyles.action, !canMoveDown && styles.disabled]}
        onPress={() => void act('queueMoveDown', selected.id)}>
        <Feather name="arrow-down" size={17} color={color(palette.muted, 'muted')} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t("client.chat.editQueuedMessage")}
        disabled={disabled || editDisabled || selected.busy} style={queueStyles.action}
        onPress={() => void edit(selected.id)}>
        <Text style={[styles.buttonText, (disabled || editDisabled || selected.busy) && styles.disabled]}>{t("client.chat.edit.051836")}</Text>
      </Pressable></View></View>
    <ScrollView style={queueStyles.list} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
      {messages.map((message) => <View key={message.id}
        style={[queueStyles.item, messages.length > 1 && selected.id === message.id && queueStyles.selected]}>
        <Text style={styles.subtitle}>↳</Text>
        <Pressable style={styles.fill} accessibilityRole="button" accessibilityLabel={t("client.chat.selectQueuedMessage", { value1: message.text })}
          accessibilityState={{ selected: selected.id === message.id }} onPress={() => select(message.id)}>
          <Text numberOfLines={2} style={queueStyles.text}>{message.text || t("client.chat.imageMessage")}</Text>
          {message.imageCount > 0 && <Text style={styles.subtitle}>{message.imageCount}{' '}{t("client.chat.images")}</Text>}
          {message.attachmentCount > 0 && <Text style={styles.subtitle}>{message.attachmentCount}{' '}{t("client.chat.attachments")}</Text>}
          {message.busy && <Text accessibilityLiveRegion="polite" style={styles.subtitle}>{t("client.chat.sending")}</Text>}
          {message.error && <Text accessibilityRole="alert" style={queueStyles.error}>{displayError(message.error)}</Text>}
        </Pressable>
        <Pressable accessibilityRole="button" disabled={disabled || sending} style={queueStyles.action}
          onPress={() => void act('queueSendNow', message.id)}>
          <Text style={[styles.buttonText, (disabled || sending) && styles.disabled]}>{t("client.chat.sendNow")}</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t("client.chat.deleteQueuedMessage")}
          disabled={disabled || message.busy} style={queueStyles.action}
          onPress={() => void act('queueRemove', message.id)}>
          <Text style={[styles.subtitle, (disabled || message.busy) && styles.disabled]}>×</Text></Pressable>
      </View>)}
    </ScrollView>
  </View>;
}

const useQueueStyles = createThemedStyles((color) => ({
  actions: { flexDirection: 'row', alignItems: 'center' },
  selected: { backgroundColor: color('#edf7f3', 'canvas') },
  queue: { marginHorizontal: 12, borderWidth: 1, borderColor: color(palette.border, 'border'), borderRadius: 12,
    backgroundColor: color('#fff', 'surface'), overflow: 'hidden', minHeight: 42, flexShrink: 1 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12,
    minHeight: 34 },
  list: { maxHeight: 180, flexGrow: 0, flexShrink: 1, paddingHorizontal: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1,
    borderColor: color(palette.border, 'border'), paddingVertical: 6 },
  text: { color: color(palette.ink, 'ink'), fontSize: 13, lineHeight: 20 },
  action: { minHeight: 40, minWidth: 32, paddingHorizontal: 6, justifyContent: 'center', alignItems: 'center' },
  error: { color: color(palette.danger, 'danger'), fontSize: 12, lineHeight: 18, maxWidth: 400 },
}));
