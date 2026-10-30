import { accountName } from '../../../../shared/lounge/names';
import { Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { LoungeReply } from '../../../../shared/lounge/reply';
import type { LoungeController } from '../../../../shared/lounge/controller';
import { useQuotedMessage } from '../../../../shared/lounge/useQuotedMessage';
import { getLocale, t } from '../i18n';
import { useThemeColor } from '../theme/store';
import { useLoungeStyles } from './styles';

import type { LoungeMessage } from '../../../../shared/lounge/types';

interface Props { reply: LoungeReply; cancel?: () => void; controller?: LoungeController;
  locate?: (reference: LoungeReply) => void; onLongPress?: () => void }

export function LoungeReplyPreview(props: Props) {
  return props.controller ? <ResolvedReply {...props} controller={props.controller} /> : <ReplyCard {...props} />;
}

function ResolvedReply(props: Props & { controller: LoungeController }) {
  const original = useQuotedMessage(props.controller, props.reply);
  return <ReplyCard {...props} original={original} />;
}

function ReplyCard({ reply, cancel, original, locate, onLongPress }: Props & { original?: LoungeMessage }) {
  const styles = useLoungeStyles(); const color = useThemeColor();
  const text = original?.text ?? reply.text;
  const content = <>
    <View style={styles.replyHeader}>
      <Text style={styles.replyAccount}>{cancel ? t('client.lounge.replyingTo', { account: reply.account })
        : (original ? accountName(original.sender) : reply.account)}</Text>
      {original && <Text style={styles.replyText}>{new Date(original.sentAt).toLocaleTimeString(getLocale(),
        { hour: '2-digit', minute: '2-digit' })}</Text>}
      {locate && <Ionicons name="arrow-up" size={18} color={color('#687c89', 'muted')} />}
    </View>
    {!!text && <Text style={styles.replyText}>{text}</Text>}
    {original?.images[0] && <Image source={{ uri: original.images[0] }} resizeMode="contain" style={styles.replyImage} />}
    {reply.imageCount > 0 && !original?.images[0] && <Text style={styles.replyText}>
      {t('client.lounge.quotedImages', { count: reply.imageCount })}</Text>}
  </>;
  return <View style={styles.reply}>
    {locate ? <Pressable accessibilityRole="button" accessibilityLabel={t('client.lounge.viewOriginal')}
      style={styles.replyContent} onPress={() => locate(reply)} onLongPress={onLongPress}>{content}</Pressable>
      : <View style={styles.replyContent}>{content}</View>}
    {cancel && <Pressable accessibilityRole="button" accessibilityLabel={t('client.lounge.cancelReply')}
      style={styles.iconButton} onPress={cancel}>
      <Ionicons name="close" size={20} color={color('#838892', 'muted')} /></Pressable>}
  </View>;
}
