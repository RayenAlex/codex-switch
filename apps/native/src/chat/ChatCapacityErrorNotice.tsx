import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t, useLanguage } from '../i18n';
import { createThemedStyles } from '../theme/styles';
import { textMetrics } from '../theme/text';
import { useThemeColor } from '../theme/store';
import { palette } from './styles';
import { ChatRetryButton } from './ChatRetryButton';

export function ChatCapacityErrorNotice({ turnId }: { turnId: string }) {
  const styles = useStyles();
  const color = useThemeColor();
  useLanguage();
  return <View style={styles.notice}>
    <View style={styles.content}>
      <Ionicons name="alert-circle-outline" size={20} color={color(palette.ink, 'ink')} />
      <Text style={styles.message}>{t('client.chat.modelAtCapacity')}</Text>
    </View>
    <ChatRetryButton turnId={turnId} variant="capacity" />
  </View>;
}

const useStyles = createThemedStyles(color => ({
  notice: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, minWidth: 0,
    minHeight: 52, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1,
    borderColor: color(palette.border, 'border'), borderRadius: 15 },
  content: { flexDirection: 'row', flexGrow: 1, flexShrink: 1, flexBasis: 180,
    alignItems: 'center', gap: 10, minWidth: 0 },
  message: { flexShrink: 1, maxWidth: 400, color: color(palette.ink, 'ink'), ...textMetrics(14, 22) },
}));
