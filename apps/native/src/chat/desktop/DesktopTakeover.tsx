import { Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '../../i18n';
import { createThemedStyles } from '../../theme/styles';

export function DesktopTakeover({ confirm, cancel }: { confirm: () => void; cancel: () => void }) {
  const s = useStyles();
  return <View style={s.overlay} accessibilityViewIsModal>
    <View style={s.card}>
      <Text style={s.title} accessibilityRole="header">{t('client.remoteDesktop.takeoverTitle')}</Text>
      <Text style={s.text} accessibilityRole="alert">{t('client.remoteDesktop.takeoverMessage')}</Text>
      <View style={s.actions}>
        <Pressable accessibilityRole="button" style={s.button} onPress={cancel}>
          <Text style={s.text}>{t('client.remoteDesktop.takeoverCancel')}</Text></Pressable>
        <Pressable accessibilityRole="button" style={[s.button, s.confirm]} onPress={confirm}>
          <Text style={s.text}>{t('client.remoteDesktop.takeoverConfirm')}</Text></Pressable>
      </View>
    </View>
  </View>;
}

const useStyles = createThemedStyles(color => ({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 10, padding: 16,
    backgroundColor: '#0009', justifyContent: 'center', alignItems: 'center' },
  card: { width: '100%', maxWidth: 400, padding: 20, borderRadius: 16, backgroundColor: '#171c28', gap: 16 },
  title: { fontSize: 18, fontWeight: '600', color: color('#e7edf8', 'faint') },
  text: { fontSize: 14, lineHeight: 22, color: color('#e7edf8', 'faint') },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10 },
  button: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#293449' },
  confirm: { backgroundColor: '#355987' },
}));
