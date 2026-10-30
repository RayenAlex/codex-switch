import { useState } from 'react';
import { Image, Pressable } from 'react-native';
import { t } from '../i18n';
import { useLoungeStyles } from './styles';

const MAX_WIDTH = 180;
const MAX_HEIGHT = 140;

/** Size the image to its content so contain-mode letterboxing cannot shift the visible image. */
export function LoungeImage({ uri, preview, onLongPress, onLoad }: {
  uri: string; preview: (uri: string) => void; onLongPress?: () => void; onLoad?: () => void;
}) {
  const styles = useLoungeStyles();
  const [ratio, setRatio] = useState(1);
  return <Pressable accessibilityRole="button" accessibilityLabel={t('client.lounge.previewImage')}
    onPress={() => preview(uri)} onLongPress={onLongPress} style={styles.imageWrap}>
    <Image source={{ uri }} resizeMode="contain" style={[styles.image,
      { width: Math.min(MAX_WIDTH, MAX_HEIGHT * ratio), aspectRatio: ratio }]}
      onLoad={event => {
        const { width, height } = event.nativeEvent.source;
        if (width > 0 && height > 0) setRatio(width / height);
        onLoad?.();
      }} />
  </Pressable>;
}
