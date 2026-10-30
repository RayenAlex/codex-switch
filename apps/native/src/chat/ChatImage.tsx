import { createThemedStyles } from '../theme/styles';
import { t, useLanguage } from '../i18n';
import { createContext, useContext, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useChatImage, type ImagePreviewOptions } from '../../../../shared/remote-chat/client/useChatImage';
import { palette, useStyles } from './styles';
import { useChatImagePreview } from './ChatImagePreview';

export const ChatImageContext = createContext<ImagePreviewOptions | null>(null);
const PREVIEW_ASPECT_RATIO = 4 / 3;
const SENT_IMAGE_HEIGHT = 120;

export function ChatImage({ source, description = t("client.chat.image"), sent = false }: {
  source?: string; description?: string; sent?: boolean;
}) {
  const imageStyles = useImageStyles();
  const styles = useStyles();
  useLanguage();
  const context = useContext(ChatImageContext);
  const image = useChatImage(source, context);
  const [dimensions, setDimensions] = useState<{ key: string; ratio: number }>();
  const ratio = dimensions?.key === image.key ? dimensions.ratio : 1;
  const openPreview = useChatImagePreview();
  const previewReady = !image.failed && !image.loading && Boolean(image.url);
  // Full previews retain their measured frame; sent thumbnails fit within a compact height.
  return <View style={[imageStyles.container, sent && imageStyles.sent,
    sent && { width: SENT_IMAGE_HEIGHT * ratio, aspectRatio: ratio }]}>
    {image.failed && <View style={imageStyles.notice}>
      <Text style={styles.subtitle}>
        {context?.ready ? t("client.mobile.couldNotLoadImage", { value1: description }) : t("client.errors.connectToYourComputerToViewThisImage")}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t("client.mobile.reload", { value1: description })} onPress={image.retry}>
        <Text style={styles.buttonText}>{t("client.terminal.retry")}</Text>
      </Pressable>
    </View>}
    {!image.failed && !previewReady && <Text style={styles.status}>{t("client.chat.loadingImage")}</Text>}
    {previewReady && <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button"
      accessibilityLabel={t("client.chat.enlarge", { value1: description })}
      onPress={() => { if (image.url) openPreview({ key: image.key, thumbnail: image.url,
        description, load: image.original, save: image.save }); }}>
      <Image key={image.key} source={{ uri: image.url }} accessibilityLabel={description}
        resizeMode="contain" fadeDuration={0} style={imageStyles.thumbnail} onError={image.fail}
        onLoad={sent ? ({ nativeEvent: { source: size } }) => {
          const nextRatio = size.width / size.height;
          if (Number.isFinite(nextRatio) && nextRatio > 0) setDimensions({ key: image.key, ratio: nextRatio });
        } : undefined} />
    </Pressable>}
  </View>;
}

const useImageStyles = createThemedStyles((color) => ({
  container: { width: '100%', aspectRatio: PREVIEW_ASPECT_RATIO, maxHeight: 420, marginVertical: 8,
    borderRadius: 12, backgroundColor: color(palette.pale, 'accentSoft'), alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden' },
  sent: { maxHeight: SENT_IMAGE_HEIGHT, maxWidth: '100%',
    marginVertical: 0, alignSelf: 'flex-start' },
  thumbnail: { width: '100%', height: '100%' },
  notice: { maxWidth: 400, gap: 8, paddingVertical: 10 },
}));
