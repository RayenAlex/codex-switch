import { displayError } from '../i18n/index';
import { useThemeColor } from '../theme/store';
import { t, useLanguage } from '../i18n';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { BottomSheet } from '../components/BottomSheet';

export function HostIdentityVerification({ confirm, close }: {
  confirm: (fingerprint: string) => Promise<void>; close: () => void;
}) {
  const color = useThemeColor();
  useLanguage();
  const [fingerprint, setFingerprint] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try { await confirm(fingerprint); close(); }
    catch (error) { setError(error instanceof Error ? error.message : t("client.mobile.couldNotUpdateComputerIdentityTryAgain")); }
    finally { setBusy(false); }
  };
  return <BottomSheet visible title={t("client.remoteDesktop.verifyComputerIdentity")} onClose={close} maxWidth={400}
    actions={[{ label: t("client.remoteDesktop.verifyAndReconnect"), onPress: submit, loading: busy, disabled: !fingerprint.trim() }]}>
    <View style={{ gap: 12, padding: 16, maxWidth: 400 }}>
      <Text>{t("client.remoteDesktop.openRemoteDesktopInTheComputerSSettingsCopyIts")}</Text>
      <TextInput accessibilityLabel={t("client.remoteDesktop.deviceFingerprint")} value={fingerprint} onChangeText={setFingerprint}
        autoCapitalize="none" autoCorrect={false} maxLength={100}
        style={{ borderWidth: 1, borderColor: color('#cbd5e1', 'border'), borderRadius: 8, padding: 12 }} />
      {!!error && <Text accessibilityRole="alert">{displayError(error)}</Text>}
    </View>
  </BottomSheet>;
}
