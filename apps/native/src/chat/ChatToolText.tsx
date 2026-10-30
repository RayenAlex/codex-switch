import { createThemedStyles } from '../theme/styles';
import { t, useLanguage } from '../i18n';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChatMarkdown } from './Markdown';
import { toolOutputPage } from './toolOutput';
import { palette, useStyles } from './styles';
import { SelectableChatText } from './SelectableChatText';

/** Match PC tool output paging while preserving the original payload for full-copy actions. */
export function ChatToolText({ text, markdown = false, prose = false }: {
  text: string; markdown?: boolean; prose?: boolean;
}) {
  const toolStyles = useToolStyles();
  const styles = useStyles();
  useLanguage();
  const [requestedPage, setPage] = useState(0);
  const { page, pages, visible } = toolOutputPage(text, requestedPage);
  const copy = { text, label: t("client.mobile.copyFullContent") };
  return <View style={toolStyles.content}>
    {markdown ? <ChatMarkdown text={visible} copy={copy} />
      : <SelectableChatText style={prose ? toolStyles.prose : styles.code} copy={copy}>
        {visible.trimEnd()}</SelectableChatText>}
    {pages > 1 && <View style={toolStyles.paging}>
      <Text style={styles.subtitle}>{t("client.chat.longContentIsShownInSections")}</Text>
      <Pressable accessibilityRole="button" disabled={!page} onPress={() => setPage(page - 1)}>
        <Text style={[styles.subtitle, !page && styles.disabled]}>{t("client.chat.previousSection")}</Text></Pressable>
      <Text style={styles.subtitle}>{page + 1} / {pages}</Text>
      <Pressable accessibilityRole="button" disabled={page === pages - 1} onPress={() => setPage(page + 1)}>
        <Text style={[styles.subtitle, page === pages - 1 && styles.disabled]}>{t("client.chat.nextSection")}</Text></Pressable>
    </View>}
  </View>;
}

const useToolStyles = createThemedStyles((color) => ({
  content: { gap: 8 },
  prose: { color: color(palette.ink, 'ink'), fontSize: 12, lineHeight: 20 },
  paging: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, maxWidth: 400 },
}));
