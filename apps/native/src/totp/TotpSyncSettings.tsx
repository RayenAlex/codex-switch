import { createThemedStyles } from '../theme/styles';
import { useThemeColor } from '../theme/store';
import { t, useLanguage } from '../i18n';
import { useState } from 'react';
import { ActivityIndicator, Switch, Text, View } from 'react-native';
import type { TotpManagerState } from './types';

export function TotpSyncSettings({ manager }: { manager: TotpManagerState }) {
  const styles = useStyles();
  const color = useThemeColor();
  useLanguage();
  const [changing, setChanging] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; error: boolean } | null>(null);
  const change = async (enabled: boolean) => {
    setChanging(true);
    setFeedback(null);
    try {
      await manager.setCloudSyncEnabled(enabled);
      setFeedback({ message: enabled ? t("client.mobile.2faCloudSyncEnabled") : t("client.mobile.2faCloudSyncDisabled"), error: false });
    } catch {
      setFeedback({ message: enabled ? t("client.mobile.syncIncompleteTryAgainLater") : t("client.mobile.couldNotDisable2faCloudSyncTryAgain"), error: true });
    } finally {
      setChanging(false);
    }
  };
  const disabled = changing || manager.syncing || !manager.initialized;
  return <>
    <Text style={styles.sectionLabel}>{t("client.app.2faKeys")}</Text>
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.copy}>
          <Text style={styles.title}>{t("client.mobile.automaticCloudSync")}</Text>
          <Text style={styles.description}>{t("client.mobile.syncChangesAutomaticallyWhenOffPullDownOnThe2fa")}</Text>
        </View>
        {disabled ? <ActivityIndicator color={color("#18af8c", 'accent')} size="small" /> : <Switch
          accessibilityLabel={t("client.mobile.sync2faKeysToTheCloud")} value={manager.cloudSyncEnabled}
          onValueChange={(enabled) => void change(enabled)}
          trackColor={{ false: '#c8d6cd', true: '#87d9cb' }}
          thumbColor={manager.cloudSyncEnabled ? '#18af8c' : '#fff'} />}
      </View>
      <Text style={styles.warning}>
        {t("client.mobile.offByDefaultWhenEnabledYourPhoneSSecretKeys")}</Text>
      {feedback ? <Text accessibilityRole="alert" style={[styles.feedback, feedback.error && styles.error]}>
        {feedback.message}
      </Text> : null}
    </View>
  </>;
}

const useStyles = createThemedStyles((color) => ({
  sectionLabel: {
    color: color('#6f8177', 'muted'),
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 3,
    marginBottom: 9,
    marginTop: 2,
  },
  card: {
    backgroundColor: color('#fff', 'surface'),
    borderColor: color('#dce8df', 'border'),
    borderWidth: 1,
    borderRadius: 16,
    padding: 17,
    marginBottom: 22,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  copy: { flex: 1, minWidth: 0 },
  title: { color: color('#13231c', 'ink'), fontSize: 16, fontWeight: '800' },
  description: { color: color('#6f8177', 'muted'), fontSize: 12, lineHeight: 18, marginTop: 6 },
  warning: { color: color('#9a6c17', 'warning'), fontSize: 11, lineHeight: 17, marginTop: 13 },
  feedback: { color: color('#14806f', 'accent'), fontSize: 12, lineHeight: 18, marginTop: 12 },
  error: { color: color('#dc5c55', 'danger') },
}));
