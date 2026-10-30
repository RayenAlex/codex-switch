import { useContext, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MessageAttachment } from '../../../../shared/chat/messageAttachments';
import { parseFileReference } from '../../../../shared/chat/fileReference';
import { useAttachmentDetails } from '../../../../shared/chat/useAttachmentDetails';
import { BottomSheet } from '../components/BottomSheet';
import { SheetScrollView } from '../components/SheetScrollView';
import { t, useLanguage } from '../i18n';
import { createThemedStyles } from '../theme/styles';
import { useThemeColor } from '../theme/store';
import { textMetrics } from '../theme/text';
import { ChatFileContext } from './ChatFilePreview';
import { useChatQuotes } from './ChatQuotes';

const DETAILS_WIDTH = 400;

function AttachmentDetails({ file, onClose }: { file: MessageAttachment; onClose: () => void }) {
  const styles = useAttachmentStyles();
  const color = useThemeColor();
  const openFile = useContext(ChatFileContext);
  const { name, path, sizeText, modifiedText } = useAttachmentDetails(file, t);
  const reference = parseFileReference(file.path);
  const open = file.kind === 'file' && reference && openFile ? () => {
    onClose();
    // Attachment paths are literal filesystem names, not Markdown links with line suffixes.
    openFile({ path: /^file:/i.test(file.path) ? reference.path : file.path });
  } : undefined;
  return <View style={styles.file}>
    <Ionicons name={file.kind === 'folder' ? 'folder-outline' : 'document-outline'}
      size={20} color={color('#17211b', 'ink')} style={styles.icon} />
    <View style={styles.info}>
      <Text style={styles.label}>{t('client.chat.attachments.name')}</Text>
      {open ? <Pressable accessibilityRole="button" onPress={open} style={styles.openFile}>
        <Text style={[styles.value, styles.link]}>{name}</Text>
      </Pressable> : <Text selectable style={styles.value}>{name}</Text>}
      <Text style={styles.label}>{t('client.chat.attachments.path')}</Text>
      <Text selectable style={styles.value}>{path}</Text>
      <Text style={styles.label}>{t('client.chat.attachments.size')}</Text>
      <Text style={styles.value}>{sizeText}</Text>
      {modifiedText && <>
        <Text style={styles.label}>{t('client.chat.attachments.modified')}</Text>
        <Text style={styles.value}>{modifiedText}</Text>
      </>}
    </View>
  </View>;
}

export function ChatMessageAttachments({ attachments }: { attachments: MessageAttachment[] }) {
  const styles = useAttachmentStyles();
  const color = useThemeColor();
  useLanguage();
  const [open, setOpen] = useState(false);
  const active = useChatQuotes()?.active ?? true;
  useEffect(() => { if (!active) setOpen(false); }, [active]);
  if (!attachments.length) return null;
  return <View style={styles.root}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }}
      accessibilityLabel={t('client.chat.attachments.view', { count: attachments.length })}
      style={styles.button} onPress={() => setOpen(true)}>
      <Ionicons name="attach" size={18} color={color('#17211b', 'ink')} />
      <Text style={styles.count}>{t('client.chat.attachments.count', { count: attachments.length })}</Text>
    </Pressable>
    {open && active && <BottomSheet visible title={t('client.chat.attachments.details')}
      maxWidth={DETAILS_WIDTH} onClose={() => setOpen(false)}>
      <SheetScrollView contentContainerStyle={styles.details}>
        {attachments.map((file, index) => <AttachmentDetails key={file.path || index}
          file={file} onClose={() => setOpen(false)} />)}
      </SheetScrollView>
    </BottomSheet>}
  </View>;
}

const useAttachmentStyles = createThemedStyles(color => ({
  root: { maxWidth: '100%' },
  button: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6,
    maxWidth: '100%', minHeight: 40, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
    borderWidth: 1, borderColor: color('#dfe5df', 'border'), backgroundColor: color('#fff', 'surface') },
  count: { ...textMetrics(13, 20), flexShrink: 1, color: color('#17211b', 'ink') },
  details: { paddingHorizontal: 0, paddingBottom: 20, gap: 18 },
  file: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  icon: { marginTop: 4, flexShrink: 0 },
  info: { flex: 1, minWidth: 0 },
  label: { ...textMetrics(12, 18), color: color('#718078', 'muted') },
  value: { ...textMetrics(14, 21), flexShrink: 1, color: color('#17211b', 'ink'), marginBottom: 6 },
  openFile: { minHeight: 40, justifyContent: 'center' },
  link: { color: color('#0b8065', 'accent'), textDecorationLine: 'underline' },
}));
