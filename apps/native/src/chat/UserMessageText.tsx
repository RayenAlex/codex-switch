import { createThemedStyles } from '../theme/styles';
import { t, useLanguage } from '../i18n';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { QuoteChip, QuoteDetails } from './ChatQuoteView';
import { useChatQuotes } from './ChatQuotes';
import { ChatMarkdown } from './Markdown';
import { quotedMessage } from './quotedMessage';
import { messageAttachments } from '../../../../shared/chat/messageAttachments';
import type { messageReferences } from '../../../../shared/chat/messageReferences';
import { ChatMessageReferences } from './ChatMessageReferences';
import { ChatMessageAttachments } from './ChatMessageAttachments';
import { CopyTextButton } from './CopyTextButton';

export function UserMessageText({ text, references = [], copy = false, compact = false }: {
  text: string; references?: ReturnType<typeof messageReferences>; copy?: boolean; compact?: boolean;
}) {
  const messageStyles = useMessageStyles();
  useLanguage();
  const message = useMemo(() => quotedMessage(text), [text]);
  const files = messageAttachments(message.text, references);
  const [selected, setSelected] = useState<number | null>(null);
  const active = useChatQuotes()?.active ?? true;
  useEffect(() => { if (!active) setSelected(null); }, [active]);
  const quote = selected === null ? undefined : message.quotes[selected];
  if (!files.text && !files.attachments.length && !files.references.length && !message.quotes.length) return null;
  return <View style={messageStyles.content}>
    <ChatMessageReferences references={files.references} />
    {!!message.quotes.length && <View style={messageStyles.quotes}>
      {message.quotes.map((_, index) => <QuoteChip key={index} label={t("client.mobile.viewMessageQuote", { value1: index + 1 })}
        onOpen={() => setSelected(index)} />)}
    </View>}
    <ChatMessageAttachments key={text} attachments={files.attachments} />
    {!!files.text && <ChatMarkdown text={files.text} user compact={compact}
      copy={copy ? { text, label: t("client.chat.copyMessage") } : undefined} />}
    {copy && !files.text && !!text && <CopyTextButton text={text} label={t('client.chat.copyMessage')} />}
    {quote !== undefined && active && <QuoteDetails text={quote} onClose={() => setSelected(null)} />}
  </View>;
}

const useMessageStyles = createThemedStyles(() => ({
  content: { gap: 10 },
  quotes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
}));
