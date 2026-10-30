import { accountName } from '../../../../shared/lounge/names';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { conversationActions, type ConversationAction } from '../../../../shared/lounge/conversationActions';
import type { ConversationRow } from '../../../../shared/lounge/conversationRows';
import type { LoungeController } from '../../../../shared/lounge/controller';
import type { MobileLounge } from '../../../../shared/lounge/useMobileLounge';
import { t } from '../i18n';
import { textMetrics } from '../theme/text';
import { LoungeAvatar } from './LoungeMessage';
import { LoungeSheet } from './LoungeSheet';
import { createLoungeStyles, useLoungeColor } from './theme';

const icons = { direct: 'chatbubble-ellipses-outline', pin: 'pin-outline',
  block: 'ban-outline', delete: 'trash-outline', notifications: 'notifications-off-outline' } as const;

export function LoungeChatActions({ row, model, controller, close }: {
  row: ConversationRow; model: MobileLounge; controller: LoungeController; close: () => void;
}) {
  const styles = useStyles();
  const actions = conversationActions({ row, model, controller, close });
  return <LoungeSheet close={close} title={<View style={styles.contact}>
    {row.user && <LoungeAvatar user={row.user} />}<View style={styles.identity}>
      <Text accessibilityRole="header" style={styles.account}>
        {row.user ? accountName(row.user) : t('client.lounge.groupChat')}</Text>
      <Text style={styles.subtitle}>{t(row.user ? 'client.lounge.privateChats' : 'client.lounge.publicRoom')}</Text>
    </View>
  </View>}>
    <View style={styles.actions}>
      <View style={styles.group}>{actions.filter(action => action.key !== 'delete').map((action, index) =>
        <LoungeChatAction key={action.key} action={action} separator={index > 0} />)}</View>
      {actions.filter(action => action.key === 'delete').map(action =>
        <View key={action.key} style={styles.group}><LoungeChatAction action={action} /></View>)}
    </View>
  </LoungeSheet>;
}

function LoungeChatAction({ action, separator }: { action: ConversationAction; separator?: boolean }) {
  const styles = useStyles(); const color = useLoungeColor();
  const danger = action.key === 'delete';
  const primary = action.key === 'direct';
  const iconColor = danger ? color('#c14c51', 'danger') : color('#456c96', 'info');
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!action.disabled }}
    disabled={action.disabled} onPress={action.onPress}
    style={({ pressed }) => [styles.action, pressed && styles.pressed, action.disabled && styles.disabled]}>
    {separator && <View style={styles.separator} />}
    <View style={[styles.icon, primary && styles.primaryIcon, danger && styles.dangerIcon]}>
      <Ionicons name={action.active && action.key === 'pin' ? 'pin' : icons[action.key]}
        size={20} color={iconColor} accessible={false} />
    </View>
    <Text style={[styles.label, danger && styles.dangerLabel]}>{t(action.label)}</Text>
  </Pressable>;
}

const useStyles = createLoungeStyles(color => ({
  contact: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  identity: { flex: 1, minWidth: 0 },
  account: { ...textMetrics(15, 22), color: color('#202b33', 'ink'), fontWeight: '600' },
  subtitle: { ...textMetrics(12, 18), color: color('#687c89', 'muted'), marginTop: 1 },
  actions: { gap: 10, paddingTop: 16 },
  group: { borderRadius: 16, overflow: 'hidden', backgroundColor: color('#f5f7f8', 'canvas') },
  action: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58,
    paddingHorizontal: 14, paddingVertical: 10 },
  separator: { position: 'absolute', top: 0, left: 60, right: 14,
    height: 1, backgroundColor: color('#e4e9ed', 'border') },
  icon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  primaryIcon: { backgroundColor: color('#deebf7', 'infoSoft') },
  dangerIcon: { backgroundColor: color('#fbecee', 'dangerSoft') },
  label: { ...textMetrics(15, 22), flex: 1, color: color('#202b33', 'ink'), fontWeight: '500' },
  dangerLabel: { color: color('#c14c51', 'danger') },
  pressed: { backgroundColor: color('#e9eef1', 'elevated') },
  disabled: { opacity: 0.38 },
}));
