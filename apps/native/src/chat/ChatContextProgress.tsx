import { Pressable, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { contextUsage } from '../../../../shared/context-usage/values';
import { remainingStroke } from '../../../../shared/quota';
import { contextUsageLabel } from '../../../../shared/remote-chat/contextUsage';
import { t, useLanguage } from '../i18n';
import { createThemedStyles } from '../theme/styles';
import { useThemeColor } from '../theme/store';
import { textMetrics } from '../theme/text';
import type { ThreadTokenUsage } from './types';

export function ChatContextProgress({ usage, onSettings }: {
  usage?: ThreadTokenUsage; onSettings?: () => void;
}) {
  const styles = useStyles();
  const color = useThemeColor();
  const language = useLanguage();
  const label = contextUsageLabel(usage, language);
  const percent = contextUsage(usage)?.percent ?? undefined;
  return <View>
    <View style={styles.track} pointerEvents="none" accessible accessibilityRole="progressbar"
      accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: percent, text: label }}>
      {percent !== undefined && <View style={[styles.fill, {
        width: `${percent}%`, backgroundColor: remainingStroke(100 - percent),
      }]} />}
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel={t('client.chat.setContextCapacityForThisChat')}
      accessibilityState={{ disabled: !onSettings }} disabled={!onSettings} onPress={onSettings}
      style={({ pressed }) => [styles.content, pressed && styles.pressed]}>
      {/* Inline icon follows the last glyph when text wraps; the bar provides the touch target. */}
      <Text style={styles.text} accessible={false}>{label}{'\u00a0'}
        <Feather name="settings" size={14} color={color(onSettings ? '#52645b' : '#8b9690', 'muted')} />
      </Text>
    </Pressable>
  </View>;
}

const useStyles = createThemedStyles(color => ({
  track: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, borderRadius: 6,
    overflow: 'hidden', backgroundColor: '#71807814' },
  fill: { height: '100%', opacity: 0.25 },
  content: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  text: { ...textMetrics(12, 20), color: color('#17211b', 'ink'), textAlign: 'center' },
  pressed: { backgroundColor: '#71807814' },
}));
