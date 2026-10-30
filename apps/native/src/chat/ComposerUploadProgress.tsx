import { createThemedStyles } from '../theme/styles';
import { t, useLanguage } from '../i18n';
import { StyleSheet, Text, View } from 'react-native';
import type { UploadProgress } from '../../../../shared/remote-chat/uploadProgress';

export function ComposerUploadProgress({ progress, reconnecting = false, inline = false }: {
  progress?: UploadProgress; reconnecting?: boolean; inline?: boolean;
}) {
  const styles = useStyles();
  useLanguage();
  if (!progress) return null;
  let label = t("client.chat.uploading");
  if (progress.percent === 0) label = t("client.chat.queued.2b6f8f");
  if (progress.percent === 100) label = t("client.chat.uploaded");
  if (progress.phase === 'preparing') label = t("client.shared.preparing");
  if (progress.phase === 'confirming') label = t("client.chat.finishing");
  if (reconnecting && progress.percent < 100) label = t("client.chat.waiting");
  return <View pointerEvents="none" style={inline ? styles.inline : styles.overlay}
    accessibilityRole="progressbar" accessibilityLabel={t("client.mobile.attachmentUploadProgress", { value1: label })}
    accessibilityValue={{ min: 0, max: 100, now: progress.percent, text: `${label} ${progress.percent}%` }}>
    <Text style={[styles.percent, inline && styles.inlineText]}>{progress.percent}%</Text>
    <Text style={[styles.label, inline && styles.inlineText]}>{label}</Text>
    {!inline && <View style={styles.track}>
      <View style={[styles.fill, { width: `${progress.percent}%` }]} />
    </View>}
  </View>;
}

const useStyles = createThemedStyles((color) => ({
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 2,
    borderTopLeftRadius: 12, borderTopRightRadius: 12, padding: 6, backgroundColor: 'rgba(12, 24, 22, 0.6)' },
  percent: { color: '#fff', fontSize: 18, lineHeight: 24, fontWeight: '600', fontVariant: ['tabular-nums'] },
  label: { color: '#fff', fontSize: 12, lineHeight: 18, includeFontPadding: true, textAlign: 'center' },
  track: { position: 'absolute', bottom: 8, left: 10, right: 10, height: 3, borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.25)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2, backgroundColor: color('#fff', 'surface') },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  inlineText: { color: color('#28766c', 'accent'), fontSize: 11, lineHeight: 18 },
}));
