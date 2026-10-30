import { createThemedStyles } from '../theme/styles';
import { useThemeColor } from '../theme/store';
import { t, useLanguage } from '../i18n';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatTurnDuration, turnElapsedMs } from '../../../desktop/src/pages/codexGui/turnTiming';
import type { WorkEntry } from './turnPresentation';
import { palette, useStyles } from './styles';

export function ChatProcessSummary({ entry, onOpen, onInline }: {
  entry: WorkEntry; onOpen: () => void; onInline: (turnId: string, inline: boolean) => void;
}) {
  const processStyles = useProcessStyles();
  const styles = useStyles();
  const color = useThemeColor();
  useLanguage();
  const running = entry.turn.status === 'inProgress';
  const elapsed = entry.timed ? turnElapsedMs(entry.turn, 0) : null;
  const label = elapsed == null ? (running ? t("client.chat.working") : t("client.chat.activity")) : t("client.chat.duration", { value1: formatTurnDuration(elapsed) });
  const toggle = entry.inline || ['inProgress', 'interrupted', 'failed'].includes(entry.turn.status);
  return <View style={processStyles.row}>
    <Pressable accessibilityRole="button" accessibilityLabel={t("client.chat.viewActivityActions", { value1: entry.items.length })}
      style={processStyles.open} onPress={onOpen}>
      <Text style={[styles.subtitle, processStyles.label]}>
        {label}{'  '}<Ionicons name="chevron-forward" size={14} color={color(palette.muted, 'muted')} />
      </Text>
    </Pressable>
    {toggle && <Pressable accessibilityRole="button"
      accessibilityLabel={entry.inline ? t("client.chat.collapseActivity") : t("client.chat.expandActivity")}
      accessibilityState={{ expanded: entry.inline }} hitSlop={6}
      style={processStyles.toggle} onPress={() => onInline(entry.turn.id, !entry.inline)}>
      <Text style={[styles.subtitle, processStyles.toggleLabel]}>{entry.inline ? t("client.chat.collapse") : t("client.chat.expand")}</Text>
      <Ionicons name={entry.inline ? 'chevron-up' : 'chevron-down'} size={14} color={color(palette.muted, 'muted')} />
    </Pressable>}
  </View>;
}

const useProcessStyles = createThemedStyles(() => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  open: { flex: 1, minWidth: 0, minHeight: 36, justifyContent: 'center' },
  // Fill the available width: Android's fallback font can clip the last glyph at its intrinsic width.
  // Keep the chevron inline so it follows the complete label, including when the label wraps.
  label: { width: '100%', paddingVertical: 2, includeFontPadding: true },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, paddingHorizontal: 4,
    flexShrink: 0, maxWidth: '50%' },
  toggleLabel: { flexShrink: 1, paddingVertical: 2, includeFontPadding: true },
}));
