import { SheetGestureScrollView as ScrollView } from '../components/SheetScrollGesture';
import { displayError, t, useLanguage } from '../i18n';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import { fetchUserProfile } from '../api/client';
import type { AuthSession } from '../types';
import { useDesktopUpdate } from '../../../../shared/desktop-update/useDesktopUpdate';
import { useStyles } from './styles';

export function DesktopVersionSheet({ session, onClose }: { session: AuthSession; onClose: () => void }) {
  useLanguage();
  const options = useMemo(() => ({ authorize: async () => {
    await fetchUserProfile(session); return session;
  } }), [session]);
  const update = useDesktopUpdate(options);
  return <DesktopVersionContent update={update} onClose={onClose} />;
}

export function DesktopVersionContent({ update, onClose }: {
  update: ReturnType<typeof useDesktopUpdate>; onClose: () => void;
}) {
  const styles = useStyles();
  useLanguage();
  const [confirmation, setConfirmation] = useState<{ deviceId: string; version: string } | null>(null);
  const status = update.status;
  const canConfirm = update.canInstall && confirmation?.deviceId === update.selectedId
    && confirmation.version === status?.latestVersion;
  const install = () => {
    if (!canConfirm || !confirmation) return;
    update.install(confirmation.version);
    setConfirmation(null);
  };
  return <BottomSheet visible title={confirmation ? t("client.settings.installDesktopUpdate") : t("client.settings.desktopVersion")} onClose={onClose}
    actions={confirmation ? [
      { label: t("client.settings.notNow"), onPress: () => setConfirmation(null) },
      { label: t("client.settings.installAndRestart"), tone: 'primary', disabled: !canConfirm, onPress: install },
    ] : [
      { label: t("client.settings.checkForUpdates"), onPress: update.check, disabled: !update.canCheck },
      { label: t("client.settings.installUpdate"), tone: 'primary', disabled: !update.canInstall,
        onPress: () => {
          if (status?.latestVersion) setConfirmation({ deviceId: update.selectedId, version: status.latestVersion });
        } },
    ]}>
    <ScrollView><View style={styles.sheetBody}>
      {confirmation ? <>
        <Text style={styles.detailLabel}>{update.device?.name} · v{confirmation.version}</Text>
        <Text style={styles.hint}>{t("client.settings.theDesktopAppWillRestartActiveConnectionsAndTasksMay")}</Text>
      </> : <>
        <Text style={styles.detailLabel}>{t("client.settings.chooseAComputer")}</Text>
        {!update.connected && <Text style={styles.hint}>{t("client.settings.connecting")}</Text>}
        {update.connected && !update.devices.length && <Text style={styles.hint}>
          {t("client.settings.noComputersYetSignInToTheDesktopAppWith")}</Text>}
        {update.devices.map((device) => <Pressable key={device.deviceId} accessibilityRole="radio"
          accessibilityState={{ checked: device.deviceId === update.selectedId }}
          onPress={() => update.select(device.deviceId)} style={styles.input}>
          <Text style={styles.detailLabel}>{device.deviceId === update.selectedId ? '● ' : '○ '}{device.name}</Text>
          <Text style={styles.hint}>{device.platform} · {device.online ? t("client.chat.online") : t("client.chat.offline")}</Text>
        </Pressable>)}
        {update.device && <>
          <Text style={styles.detailLabel}>{t("client.settings.version")}</Text>
          <Text selectable style={styles.detailValue}>
            {status?.currentVersion || update.device.appVersion || t("client.settings.versionUnavailable")}</Text>
          {(!status || !update.connected || !update.device.online) && update.device.appVersion
            && <Text style={styles.hint}>{t("client.settings.versionFromTheLastConnection")}</Text>}
          {status?.latestVersion && <Text style={styles.detailLabel}>{t("client.mobile.availableVersionV")}{status.latestVersion}</Text>}
          <Text accessibilityLiveRegion="polite" style={styles.hint}>{displayError(update.message)}</Text>
          {status?.phase === 'downloading' && status.progress !== null
            && <Text style={styles.detailValue}>{status.progress}%</Text>}
          {status?.notes && <Text selectable style={styles.hint}>{status.notes}</Text>}
        </>}
      </>}
      {!!update.error && <Text accessibilityRole="alert" style={styles.error}>{displayError(update.error)}</Text>}
    </View></ScrollView>
  </BottomSheet>;
}
