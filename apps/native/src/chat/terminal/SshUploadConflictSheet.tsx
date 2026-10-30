import { Text, View } from 'react-native';
import type { SshFileActions } from '../../../../../shared/terminal/useSshFileActions';
import { BottomSheet } from '../../components/BottomSheet';
import { t } from '../../i18n';
import { SshButton } from './SshControls';
import { useSshStyles } from './sshStyles';

export function SshUploadConflictSheet({ actions }: { actions: SshFileActions }) {
  const styles = useSshStyles();
  if (!actions.conflict) return null;
  return <BottomSheet visible maxWidth={400} title={t('client.ssh.uploadConflictTitle')}
    onClose={() => actions.chooseConflict(undefined)}>
    <View style={styles.content}>
      <Text style={styles.hint}>{t('client.ssh.uploadConflictHint', { name: actions.conflict })}</Text>
      <SshButton label={t('client.ssh.overwrite')} onPress={() => actions.chooseConflict('overwrite')} />
      <SshButton label={t('client.ssh.keepBoth')} onPress={() => actions.chooseConflict('rename')} />
      <SshButton label={t('client.ssh.cancel')} onPress={() => actions.chooseConflict(undefined)} />
    </View>
  </BottomSheet>;
}
