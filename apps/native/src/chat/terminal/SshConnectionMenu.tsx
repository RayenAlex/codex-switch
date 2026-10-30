import { SheetGestureScrollView as ScrollView } from '../../components/SheetScrollGesture';
import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import type { SshApi } from '../../../../../shared/terminal/ssh';
import { sshLabel, type SshProfile } from '../../../../../shared/terminal/sshProfiles';
import type { TerminalInfo } from '../../../../../shared/terminal/types';
import { useSshProfiles } from '../../../../../shared/terminal/useSshProfiles';
import { BottomSheet } from '../../components/BottomSheet';
import { displayError, t, useLanguage } from '../../i18n';
import { SshConnectionSheet } from './SshConnectionSheet';
import { SshQuickConnectSheet } from './SshQuickConnectSheet';
import { SshButton } from './SshControls';
import { useSshStyles } from './sshStyles';

export function SshConnectionMenu({ api, cwd, connected, dispose, close }: {
  api: SshApi; cwd: string; connected: (info: TerminalInfo) => void;
  dispose: (id: string) => Promise<void>; close: () => void;
}) {
  useLanguage();
  const styles = useSshStyles();
  const saved = useSshProfiles(api.profiles, false);
  const [dialog, setDialog] = useState<{ profile?: SshProfile }>();
  if (dialog?.profile) return <SshQuickConnectSheet api={api} cwd={cwd} profile={dialog.profile}
    connected={connected} dispose={dispose} close={close} />;
  if (dialog) return <SshConnectionSheet api={api} cwd={cwd}
    connected={connected} dispose={dispose} close={close} />;

  return <BottomSheet visible title={t('client.ssh.savedConnections')} onClose={close}
    maxWidth={400}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <View style={styles.row}>
        <SshButton label={t('client.ssh.new')} onPress={() => setDialog({})} />
        <SshButton label={t('client.ssh.refresh')} disabled={saved.loading}
          onPress={() => void saved.refresh()} />
      </View>
      {saved.loading && <ActivityIndicator />}
      {!!saved.error && <Text accessibilityRole="alert" style={styles.error}>{displayError(saved.error)}</Text>}
      {saved.profiles.map(profile => <SshButton key={profile.id} label={profile.name || sshLabel(profile)}
        disabled={saved.loading || !!saved.error} onPress={() => setDialog({ profile })} />)}
      {!saved.loading && !saved.error && !saved.profiles.length && <Text style={styles.hint}>
        {t('client.ssh.noSavedConnections')}</Text>}
      <SshButton label={t('client.ssh.manage')} onPress={() => setDialog({})} />
    </ScrollView>
  </BottomSheet>;
}
