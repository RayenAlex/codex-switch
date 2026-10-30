import { useThemeColor } from '../theme/store';
import { t, useLanguage } from '../i18n';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import type { useAppUpdate } from './useAppUpdate';
import { useStyles } from './styles';
import { useStyles as useSettingsStyles } from '../settings/styles';
import { updateDownloadPercent } from '../update/androidDownloadProgress';

type UpdateState = ReturnType<typeof useAppUpdate>;

function updateAction(update: UpdateState) {
  const { downloadState, updateCheck, checking } = update;
  if (downloadState.status === 'downloaded') return { label: t("client.mobile.installNow"), onPress: update.installDownloaded };
  if (downloadState.status === 'downloading') {
    if (downloadState.cancelling) return { label: t("client.mobile.cancelling"), busy: true };
    if (downloadState.progress?.phase === 'verifying') return { label: t("client.downloads.verifying"), busy: true };
    const percent = updateDownloadPercent(downloadState.progress);
    return { label: percent === null ? t("client.downloads.downloading.e2fc57") : t("client.downloads.downloading", { percent }), busy: true };
  }
  if (checking) return { label: t("client.mobile.checking"), busy: true };
  if (updateCheck?.updateAvailable) {
    return { label: ['failed', 'cancelled'].includes(downloadState.status) ? t("client.mobile.downloadAgain") : t("client.mobile.update"),
      onPress: () => update.beginDownload(updateCheck.release) };
  }
  if (update.error) return { label: t("client.terminal.retry"), onPress: () => void update.checkForUpdate() };
  return { label: updateCheck ? t("client.mobile.upToDate") : t("client.settings.checkForUpdates"), current: Boolean(updateCheck),
    onPress: () => void update.checkForUpdate() };
}

export function VersionUpdateButton({ update }: { update: UpdateState }) {
  const resolveThemeColor = useThemeColor();
  const styles = useStyles();
  const settingsStyles = useSettingsStyles();
  const color = useThemeColor();
  useLanguage();
  const action = updateAction(update);
  return <Pressable accessibilityRole="button" accessibilityLabel={action.label}
    accessibilityState={{ disabled: Boolean(action.busy), busy: Boolean(action.busy) }} disabled={Boolean(action.busy)}
    onPress={action.onPress} style={({ pressed }) => [styles.versionButton,
      action.current && styles.currentButton, pressed && settingsStyles.pressed]}>
    {action.busy ? <ActivityIndicator size="small" color={color("#079c70", 'accent')} />
      : <Ionicons name={action.current ? 'checkmark-circle-outline' : 'arrow-up-circle-outline'}
        size={16} color={action.current ? resolveThemeColor('#7d8496', 'muted') : resolveThemeColor('#079c70', 'accent')} />}
    <Text style={[styles.versionButtonText, action.current && styles.currentText]}>{action.label}</Text>
  </Pressable>;
}
