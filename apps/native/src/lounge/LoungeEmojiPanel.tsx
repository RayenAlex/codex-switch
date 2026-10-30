import { Pressable, ScrollView, Text, View } from 'react-native';
import { LOUNGE_EMOJI } from '../../../../shared/lounge/emoji';
import { t } from '../i18n';
import { textMetrics } from '../theme/text';
import { createLoungeStyles } from './theme';

export function LoungeEmojiPanel({ height, insert }: { height: number; insert: (emoji: string) => void }) {
  const styles = useStyles();
  return <View testID="lounge-emoji-panel" style={[styles.panel, { height }]}>
    <ScrollView keyboardShouldPersistTaps="always" contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('client.lounge.emoji')}</Text>
      <View style={styles.grid}>{LOUNGE_EMOJI.map(emoji => <Pressable key={emoji}
        accessibilityRole="button" accessibilityLabel={emoji} style={styles.cell} onPress={() => insert(emoji)}>
        <Text style={styles.emoji}>{emoji}</Text>
      </Pressable>)}</View>
    </ScrollView>
  </View>;
}

const useStyles = createLoungeStyles(color => ({
  panel: { marginHorizontal: -10, overflow: 'hidden',
    backgroundColor: color('#fff', 'surface') },
  content: { paddingHorizontal: 12, paddingTop: 14, paddingBottom: 12 },
  title: { ...textMetrics(13, 20), color: color('#687c89', 'muted'), marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.285714%', minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  emoji: { ...textMetrics(28, 36) },
}));
