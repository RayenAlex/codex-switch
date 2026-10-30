import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import type { SshApi } from '../../../../../shared/terminal/ssh';
import type { TerminalInfo } from '../../../../../shared/terminal/types';
import { useSshFiles } from '../../../../../shared/terminal/useSshFiles';
import { useSshFileActions } from '../../../../../shared/terminal/useSshFileActions';
import type { NativeSshBrowserAction } from '../../../../../shared/terminal/nativeSshBrowserAction';
import { ProjectBrowser } from '../ProjectBrowser';
import { displayError, t, useLanguage } from '../../i18n';
import { createThemedStyles } from '../../theme/styles';
import { textMetrics } from '../../theme/text';
import { nativeSshDownload, pickSshUpload } from './sshTransfers';
import { nativeSshProjectBrowser } from './sshProjectBrowser';
import { SshUploadConflictSheet } from './SshUploadConflictSheet';
import { SshButton } from './SshControls';

export function SshFilesSheet({ api, info, connected, active, close }: {
  api: SshApi; info: TerminalInfo; connected: boolean; active: boolean; close: () => void;
}) {
  useLanguage();
  const styles = useStyles();
  const browser = useMemo(() => nativeSshProjectBrowser(api, info.id), [api, info.id]);
  const files = useSshFiles(api, info.id, nativeSshDownload);
  const actions = useSshFileActions(files);
  const [hidden, setHidden] = useState(true);
  const [picking, setPicking] = useState(false);
  const revision = useRef({ entries: files.entries, value: 0 });
  if (revision.current.entries !== files.entries) {
    revision.current = { entries: files.entries, value: revision.current.value + 1 };
  }
  const disabled = files.busy || picking || !connected || !active;
  const upload = async () => {
    if (disabled) return;
    setPicking(true);
    try { await pickSshUpload(file => actions.uploadSources([file])); }
    catch (error) { files.reportError(error); }
    finally { setPicking(false); }
  };
  const onAction = (action: NativeSshBrowserAction) => {
    if (disabled) return;
    if (action.action === 'hidden') setHidden(action.value);
    if (action.action === 'navigate') void files.navigate(action.path);
    if (action.action === 'upload') void upload();
  };
  return <ProjectBrowser {...browser} cwd="/" active={active} connected={connected && files.loaded}
    onClose={close} title={t('client.ssh.files')} subtitle={info.ssh?.host}
    ssh={{ settings: { path: files.path, hidden, busy: disabled, revision: revision.current.value }, onAction }}>
    {(files.busy || picking) && <ActivityIndicator />}
    {!!files.error && <Text accessibilityRole="alert" style={styles.feedback}>{displayError(files.error)}</Text>}
    {!files.loaded && !files.busy && <SshButton label={t('client.terminal.retry')} onPress={() => files.load()} />}
    {files.progress && <View style={styles.progress}>
      <Text style={styles.feedback}>{t('client.ssh.uploadingFile', { name: files.progress.name })}</Text>
      <SshButton label={t('client.ssh.cancelUpload')} onPress={files.cancelUpload} />
    </View>}
    <SshUploadConflictSheet actions={actions} />
  </ProjectBrowser>;
}

const useStyles = createThemedStyles(color => ({
  feedback: { ...textMetrics(14, 22), paddingHorizontal: 12, maxWidth: 400, color: color('#718078', 'muted') },
  progress: { padding: 8, gap: 4 },
}));
