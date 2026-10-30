import { Pressable, Text, View } from 'react-native';
import type { LoungeController } from '../../../../shared/lounge/controller';
import { t } from '../i18n';
import { useLoungeStyles } from './styles';

export function LoungeSyncNotice({ failed, controller }: { failed?: boolean; controller: LoungeController }) {
  const styles = useLoungeStyles();
  if (!failed) return null;
  return <View style={styles.notice}>
    <Text accessibilityRole="alert" style={styles.muted}>{t('client.lounge.deviceSyncFailed')}</Text>
    <Pressable accessibilityRole="button" style={styles.iconButton} onPress={() => controller.retryDeviceSync()}>
      <Text style={styles.link}>{t('client.lounge.historyRetry')}</Text>
    </Pressable>
  </View>;
}
