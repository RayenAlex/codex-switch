import { Text } from 'react-native';
import { SheetGestureScrollView as ScrollView } from '../../components/SheetScrollGesture';
import { BottomSheet } from '../../components/BottomSheet';
import { t, displayError } from '../../i18n';
import { SshButton } from './SshControls';
import { useSshStyles } from './sshStyles';
import type { useZmodemFiles } from './useZmodemFiles';
import type { ZmodemTransfer } from '../../../../../shared/terminal/zmodem';
import { zmodemMessage } from '../../../../../shared/terminal/zmodemMessage';

export function ZmodemSheet({ files, transfer, visible }: {
  files: ReturnType<typeof useZmodemFiles>; transfer?: ZmodemTransfer; visible: boolean;
}) {
  const styles = useSshStyles();
  const { state } = files;
  if (!state || !transfer) return null;
  const busy = state.phase === 'offer' || state.phase === 'transfer';
  const close = () => { if (busy) transfer.cancel(); else if (!files.saving) files.dismiss(); };
  const sending = state.direction === 'send';
  return <BottomSheet visible={visible} maxWidth={400} onClose={close}
    title={t(sending ? 'client.ssh.upload' : 'client.ssh.download')}>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.hint}>{displayError(zmodemMessage(state))}</Text>
      {state.name && <Text style={styles.label}>{state.name}</Text>}
      {state.phase === 'transfer' && !!state.size && <Text style={styles.label}>
        {Math.min(100, Math.floor(state.transferred / state.size * 100))}%
      </Text>}
      {files.downloads.map((file, index) => <SshButton key={index} disabled={files.saving || file.saved}
        label={file.saved ? t('client.ssh.downloaded') : file.name} onPress={() => { void files.save(index); }} />)}
      {!!files.error && <Text style={styles.error}>{displayError(files.error)}</Text>}
      {state.phase === 'offer' && <SshButton label={t(sending ? 'client.ssh.zmodemSelect' : 'client.ssh.zmodemReceive')}
        onPress={() => { if (sending) void files.select(transfer); else void transfer.accept(); }} />}
      <SshButton disabled={files.saving} label={t(busy ? 'client.ssh.cancel' : 'client.ssh.zmodemClose')} onPress={close} />
    </ScrollView>
  </BottomSheet>;
}
