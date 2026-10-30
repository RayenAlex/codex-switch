import { createThemedStyles } from '../theme/styles';
import { t, useLanguage } from '../i18n';
import {  View } from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import { SheetFlatList } from '../components/SheetScrollView';
import { ChatMessage } from './ChatMessage';
import type { WorkEntry } from './turnPresentation';
import { useStyles } from './styles';

export function ChatWorkDrawer({ entry, onOpen, onClose }: {
  entry: Pick<WorkEntry, 'turn' | 'items'>; onOpen: (id: string) => void; onClose: () => void;
}) {
  const workStyles = useWorkStyles();
  const styles = useStyles();
  useLanguage();
  const running = entry.turn.status === 'inProgress';
  return <BottomSheet fullWidthContent visible tall title={running ? t("client.chat.working") : t("client.chat.activity")}
    subtitle={t("client.chat.actions", { value1: entry.items.length })} onClose={onClose}>
    <SheetFlatList data={entry.items} keyExtractor={(item) => item.id} style={workStyles.list}
      contentContainerStyle={workStyles.content} keyboardShouldPersistTaps="handled"
      ItemSeparatorComponent={() => <View style={styles.processSeparator} />}
      renderItem={({ item }) => <ChatMessage item={item} onOpen={onOpen} process onQuote={onClose}
        running={running && item.status !== 'completed'} />} />
  </BottomSheet>;
}

const useWorkStyles = createThemedStyles(() => ({
  list: { flexShrink: 1 },
  content: { paddingBottom: 20 },
}));
