import { createThemedStyles } from '../theme/styles';
import { t, useLanguage } from '../i18n';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { formatTurnDuration } from '../../../desktop/src/pages/codexGui/turnTiming';
import { palette, useStyles } from './styles';
import type { Item } from './types';
import { SelectableChatText } from './SelectableChatText';

const OUTPUT_PAGE_CHARACTERS = 8_000;

function CommandText({ text, command = false, empty = '' }: { text: string; command?: boolean; empty?: string }) {
  const commandStyles = useCommandStyles();
  const styles = useStyles();
  useLanguage();
  const [requestedPage, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(text.length / OUTPUT_PAGE_CHARACTERS));
  const page = Math.min(requestedPage, pages - 1);
  return <View>
    <ScrollView nestedScrollEnabled style={command ? commandStyles.command : commandStyles.output}
      contentContainerStyle={command ? commandStyles.commandContent : commandStyles.outputContent}>
      <SelectableChatText style={styles.code}
        copy={text ? { text, label: command ? t("client.chat.copyCommand") : t("client.chat.copyOutput") } : undefined}>
        {text.slice(page * OUTPUT_PAGE_CHARACTERS, (page + 1) * OUTPUT_PAGE_CHARACTERS).trimEnd() || empty}
      </SelectableChatText>
    </ScrollView>
    {pages > 1 && <View style={commandStyles.paging}>
      <Text style={styles.subtitle}>{t("client.chat.longContentIsShownInSections")}</Text>
      <Pressable accessibilityRole="button" disabled={!page} onPress={() => setPage(page - 1)}>
        <Text style={[styles.subtitle, !page && styles.disabled]}>{t("client.chat.previousSection")}</Text></Pressable>
      <Text style={styles.subtitle}>{page + 1} / {pages}</Text>
      <Pressable accessibilityRole="button" disabled={page === pages - 1} onPress={() => setPage(page + 1)}>
        <Text style={[styles.subtitle, page === pages - 1 && styles.disabled]}>{t("client.chat.nextSection")}</Text></Pressable>
    </View>}
  </View>;
}

export function ChatCommandDetails({ item }: { item: Item }) {
  const commandStyles = useCommandStyles();
  const styles = useStyles();
  useLanguage();
  return <View style={{ gap: 8 }}>
    <View style={commandStyles.toolbar}>
      <Text selectable style={[styles.subtitle, styles.fill]}>{item.cwd}</Text>
      {item.durationMs != null && <Text style={styles.subtitle}>{formatTurnDuration(item.durationMs)}</Text>}
    </View>
    <CommandText text={item.command ?? ''} command />
    <CommandText text={item.aggregatedOutput ?? ''}
      empty={item.status === 'inProgress' ? t("client.chat.waitingForOutput") : t("client.chat.noTextOutput")} />
    <View style={commandStyles.toolbar}>
      <Text style={[styles.subtitle, styles.fill, item.exitCode !== 0 && commandStyles.failed]}>
        {item.exitCode != null ? t("client.mobile.exitCode", { value1: item.exitCode }) : ''}</Text>
    </View>
  </View>;
}

const useCommandStyles = createThemedStyles((color) => ({
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  command: { backgroundColor: color('#f4f6f5', 'canvas'), borderRadius: 5, maxHeight: 340 },
  commandContent: { paddingVertical: 8, paddingHorizontal: 10 },
  output: { maxHeight: 340 },
  outputContent: { paddingVertical: 8 },
  paging: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, maxWidth: 400 },
  failed: { color: color(palette.danger, 'danger') },
}));
