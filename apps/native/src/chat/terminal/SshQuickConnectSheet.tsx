import { SheetGestureScrollView as ScrollView } from '../../components/SheetScrollGesture';
import { ActivityIndicator, Text, View } from 'react-native';
import type { SshApi } from '../../../../../shared/terminal/ssh';
import { sshLabel, type SshProfile } from '../../../../../shared/terminal/sshProfiles';
import type { TerminalInfo } from '../../../../../shared/terminal/types';
import { useSavedSshConnection } from '../../../../../shared/terminal/useSavedSshConnection';
import { validSshValues } from '../../../../../shared/terminal/useSshConnection';
import { BottomSheet } from '../../components/BottomSheet';
import { displayError, t, useLanguage } from '../../i18n';
import { SshButton, SshField } from './SshControls';
import { useSshStyles } from './sshStyles';
import { SshHostKeySheet } from './SshHostKeySheet';

export function SshQuickConnectSheet({ api, profile, cwd, connected, dispose, close }: {
  api: SshApi; profile: SshProfile; cwd: string; connected: (info: TerminalInfo) => void;
  dispose: (id: string) => Promise<void>; close: () => void;
}) {
  useLanguage();
  const styles = useSshStyles();
  const connection = useSavedSshConnection({ api, profile, projectCwd: cwd, connected, dispose, close });
  const { busy, loading, finished, error, trust, values, needsCredentials, setCredential } = connection;
  const disabled = busy || loading || finished;
  return <BottomSheet visible title={t('client.ssh.connection')} onClose={close} dismissible={!busy}
    maxWidth={400} actions={finished ? [] : [{
      label: t(trust ? 'client.ssh.trustAndConnect' : 'client.ssh.connectAction'),
      onPress: connection.connect, loading: busy, disabled: disabled || (needsCredentials && !validSshValues(values)),
    }]}>
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}>
      <Text style={styles.label}>{sshLabel(profile)}</Text>
      {needsCredentials && <>
        <Text style={styles.hint}>{t('client.ssh.loginHint')}</Text>
        {profile.auth === 'key' ? <>
          <SshField label={t('client.ssh.privateKey')} value={values.privateKey ?? ''} multiline maxLength={65536}
            editable={!disabled} onChangeText={value => setCredential('privateKey', value)} />
          <SshField label={t('client.ssh.passphrase')} value={values.passphrase ?? ''} secureTextEntry maxLength={4096}
            editable={!disabled} onChangeText={value => setCredential('passphrase', value)} />
        </> : <SshField label={t('client.ssh.password')} value={values.password ?? ''} secureTextEntry maxLength={4096}
          editable={!disabled} onChangeText={value => setCredential('password', value)} />}
      </>}
      {(busy || loading) && <View style={styles.row}><ActivityIndicator />
        <Text style={styles.hint}>{t('client.ssh.connecting')}</Text></View>}
      {trust && !trust.previousFingerprints && <View><Text style={styles.label}>{t('client.ssh.trustHost')}</Text>
        <Text selectable style={styles.hint}>{trust.fingerprint}</Text></View>}
      {!!error && <><Text accessibilityRole="alert" style={styles.error}>{displayError(error)}</Text>
        <SshButton label={t('client.ssh.refresh')} disabled={busy || loading}
          onPress={() => void connection.refresh()} /></>}
    </ScrollView>
    <SshHostKeySheet connection={connection} />
  </BottomSheet>;
}
