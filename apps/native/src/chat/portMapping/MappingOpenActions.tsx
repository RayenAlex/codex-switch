import { displayError } from '../../i18n/index';
import { useState } from 'react';
import { Linking, Platform, Pressable, Text, View } from 'react-native';
import { t } from '../../i18n';
import { useStyles } from '../styles';

export function MappingOpenActions({ port, preview, opened }: {
  port: number; preview: () => void; opened: () => void;
}) {
  const styles = useStyles();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');
  const openBrowser = async () => {
    if (opening) return;
    setOpening(true);
    setError('');
    try {
      await Linking.openURL(`http://127.0.0.1:${port}`);
      opened();
    } catch {
      setError('无法打开浏览器，请重试。');
    } finally { setOpening(false); }
  };
  return <View style={{ gap: 10, paddingBottom: 16 }}>
    <Pressable accessibilityRole="button" disabled={opening} onPress={preview}
      style={[styles.button, styles.primary, opening && styles.disabled]}>
      <Text style={[styles.buttonText, styles.primaryText]}>{t("client.portForwarding.previewInRemoteAi")}</Text>
    </Pressable>
    <Pressable accessibilityRole="button" disabled={opening} onPress={() => { void openBrowser(); }}
      style={[styles.button, opening && styles.disabled]}>
      <Text style={styles.buttonText}>{t("client.workspaceActions.openInBrowser")}</Text>
    </Pressable>
    {Platform.OS === 'ios' && <Text style={styles.subtitle}>
      {t("client.portForwarding.switchingAppsMayInterruptTheMappingPreviewHereForA")}</Text>}
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{displayError(error)}</Text>}
  </View>;
}
