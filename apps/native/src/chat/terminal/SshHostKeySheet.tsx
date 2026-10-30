import { Text } from 'react-native';
import { SheetGestureScrollView as ScrollView } from '../../components/SheetScrollGesture';
import { BottomSheet } from '../../components/BottomSheet';
import { t } from '../../i18n';
import { useSshStyles } from './sshStyles';
import type { useSshConnection } from '../../../../../shared/terminal/useSshConnection';

export function SshHostKeySheet({ connection }: { connection: ReturnType<typeof useSshConnection> }) {
  const styles = useSshStyles();
  const { trust, busy } = connection;
  if (!trust?.previousFingerprints) return null;
  return <BottomSheet visible title={t('client.ssh.hostKeyChangedTitle')} maxWidth={400}
    onClose={connection.clearTrust} dismissible={!busy} actions={[{
      label: t('client.ssh.updateFingerprint'), loading: busy, disabled: busy,
      onPress: () => { void connection.confirmTrust(); },
    }]}>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.hint}>{t('client.ssh.hostKeyChangedHint')}</Text>
      <Text style={styles.label}>{t('client.ssh.previousFingerprint')}</Text>
      {trust.previousFingerprints.map(value => <Text key={value} selectable style={styles.hint}>{value}</Text>)}
      <Text style={styles.label}>{t('client.ssh.currentFingerprint')}</Text>
      <Text selectable style={styles.hint}>{trust.fingerprint}</Text>
    </ScrollView>
  </BottomSheet>;
}
