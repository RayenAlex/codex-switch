import { t, useLanguage } from '../i18n';
import { Pressable, Text, View } from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import { SheetScrollView, SHEET_READABLE_WIDTH } from '../components/SheetScrollView';
import type { RemoteDevice } from '../types';
import { useStyles } from './styles';

export function ChatDevices({ devices, choose, onClose }: {
  devices: RemoteDevice[]; choose: (id: string) => void; onClose: () => void;
}) {
  const styles = useStyles();
  useLanguage();
  return <BottomSheet fullWidthContent visible title={t("client.settings.chooseAComputer")} onClose={onClose}>
    <SheetScrollView contentContainerStyle={[styles.settings, { maxWidth: SHEET_READABLE_WIDTH }]}>
      {devices.map((device) => <Pressable key={device.deviceId} accessibilityRole="button"
        style={styles.card}
        onPress={() => choose(device.deviceId)}>
        <View style={styles.row}><Text style={[styles.title, styles.fill]}>{device.name}</Text>
          <Text style={styles.subtitle}>{device.online ? t("client.chat.online") : t("client.chat.offline")}</Text></View>
      </Pressable>)}
      {!devices.length && <Text style={styles.subtitle}>{t("client.chat.openRemoteAiOnYourComputerAndSignInWith")}</Text>}
    </SheetScrollView>
  </BottomSheet>;
}
