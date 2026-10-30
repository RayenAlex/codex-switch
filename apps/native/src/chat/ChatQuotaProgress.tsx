import { Text, View } from 'react-native';
import type { usageTrailing } from '../../../../shared/remote-chat/usage';
import { remainingStroke } from '../../../../shared/quota';
import { createThemedStyles } from '../theme/styles';
import { textMetrics } from '../theme/text';

export function ChatQuotaProgress({ trailing, remaining }: {
  trailing: NonNullable<ReturnType<typeof usageTrailing>>; remaining: number;
}) {
  const styles = useStyles();
  const { quota } = trailing;
  if (!quota) return <Text style={styles.api} accessibilityLabel={trailing.description}>{trailing.text}</Text>;
  const text = `${trailing.text} · ${quota.remaining} · ${quota.total}`;
  const percent = Math.min(100, Math.max(0, remaining));
  return <View accessible accessibilityRole="progressbar" accessibilityLabel={trailing.description}
    accessibilityHint={quota.description} accessibilityValue={{ min: 0, max: 100, now: percent, text }}>
    <View style={styles.track} pointerEvents="none" accessible={false}>
      <View style={[styles.fill, { width: `${percent}%`, backgroundColor: remainingStroke(Math.round(remaining)) }]} />
    </View>
    <Text style={styles.text} accessible={false}>
      <Text style={styles.percent}>{trailing.text}</Text>{' · '}{quota.remaining}{' · '}{quota.total}
    </Text>
  </View>;
}

const useStyles = createThemedStyles(color => ({
  track: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, borderRadius: 6,
    overflow: 'hidden', backgroundColor: '#71807814' },
  fill: { height: '100%', opacity: 0.25 },
  text: { ...textMetrics(12, 20), color: color('#17211b', 'ink'), paddingHorizontal: 6, textAlign: 'center' },
  percent: { fontWeight: '600' },
  api: { ...textMetrics(12, 20), color: color('#b45d00', 'warning'), fontWeight: '600' },
}));
