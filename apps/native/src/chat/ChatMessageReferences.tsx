import { displayText } from '../i18n/index';
import { Text, View } from 'react-native';
import { useLanguage } from '../i18n';
import { createThemedStyles } from '../theme/styles';
import type { messageReferences } from '../../../../shared/chat/messageReferences';
import { textMetrics } from '../theme/text';

export function ChatMessageReferences({ references }: { references: ReturnType<typeof messageReferences> }) {
  const styles = useReferenceStyles();
  useLanguage();
  if (!references.length) return null;
  return <View style={styles.list}>
    {references.map(reference => <View key={reference.path} style={styles.reference}>
      <Text style={styles.name}>{displayText(reference.label)}：{reference.name}</Text>
    </View>)}
  </View>;
}

const useReferenceStyles = createThemedStyles(color => ({
  list: { alignItems: 'flex-start', gap: 6 },
  reference: { maxWidth: '100%', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5,
    backgroundColor: color('#e6f8f1', 'accentSoft') },
  name: { ...textMetrics(13, 20), flexShrink: 1, maxWidth: 400, color: color('#14806f', 'accent') },
}));
