import { createThemedStyles } from '../theme/styles';
import { useThemeColor } from '../theme/store';
import { Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTurnRetry } from '../../../../shared/chat/TurnRetryContext';
import { t } from '../i18n';
import { palette } from './styles';

export function ChatRetryButton({ turnId, variant = 'inline' }: {
  turnId: string; variant?: 'inline' | 'capacity';
}) {
  const styles = useStyles();
  const color = useThemeColor();
  const action = useTurnRetry(turnId);
  const capacity = variant === 'capacity';
  if (!action) return null;
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: action.disabled }}
    disabled={action.disabled} hitSlop={{ top: 8, bottom: 8 }} onPress={() => { void action.retry(); }}
    style={[styles.button, capacity && styles.capacityButton, action.disabled && styles.disabled]}>
    <Ionicons name="refresh-outline" size={14}
      color={capacity ? color(palette.ink, 'ink') : color('#c96c3d', 'warning')} />
    <Text style={[styles.label, capacity && styles.capacityLabel]}>
      {action.pending ? t("client.chat.retrying") : t("client.terminal.retry")}
    </Text>
  </Pressable>;
}

const useStyles = createThemedStyles((color) => ({
  button: { flexDirection: 'row', alignItems: 'center', gap: 2, padding: 2,
    borderWidth: 1, borderColor: color('#c96c3d', 'warning'), borderRadius: 4 },
  label: { color: color('#c96c3d', 'warning'), fontSize: 12, lineHeight: 16 },
  capacityButton: { paddingVertical: 4, paddingHorizontal: 9, borderColor: color(palette.ink, 'ink') },
  capacityLabel: { color: color(palette.ink, 'ink'), fontSize: 14 },
  disabled: { opacity: 0.5 },
}));
