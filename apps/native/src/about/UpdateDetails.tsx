import { getLocale, t, useLanguage } from '../i18n';
import { Pressable, Text, View } from 'react-native';
import type { useAppUpdate } from './useAppUpdate';
import { useStyles } from './styles';
import { ReleaseNotes } from './ReleaseNotes';
import { UpdateDownloadProgress } from './UpdateDownloadProgress';

type UpdateState = ReturnType<typeof useAppUpdate>;

function DownloadStatus({ update }: { update: UpdateState }) {
  const styles = useStyles();
  useLanguage();
  const state = update.downloadState;
  if (state.status === 'idle') return null;
  if (state.status === 'downloading') return <View style={styles.status}>
    <View style={styles.statusHeading}>
      <Text style={styles.statusTitle}>{t("client.mobile.downloadingV")}{state.version}</Text>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: Boolean(state.cancelling) }}
        disabled={Boolean(state.cancelling)} onPress={update.cancelDownload} style={styles.cancelButton}>
        <Text style={styles.cancelText}>{state.cancelling ? t("client.mobile.cancelling") : t("client.mobile.cancelUpdate")}</Text>
      </Pressable>
    </View>
    <UpdateDownloadProgress progress={state.progress} />
  </View>;
  if (state.status === 'cancelled') return <View style={styles.status}>
    <Text style={styles.detail}>{t("client.mobile.downloadCancelledYouCanDownloadItAgainAtAnyTime")}</Text>
  </View>;
  if (state.status === 'failed') return <View style={styles.status}>
    <Text style={[styles.statusTitle, styles.error]}>v{state.version}{' '}{t("client.downloads.downloadFailed")}</Text>
    <Text style={styles.detail}>{t("client.mobile.downloadIncompleteCheckYourConnectionAndTapDownloadAgain")}</Text>
  </View>;
  return <View style={styles.status}>
    <Text style={styles.statusTitle}>v{state.version}{' '}{t("client.mobile.downloaded")}</Text>
    <Text style={styles.detail}>{t("client.mobile.theUpdateIsReadyToInstall")}</Text>
  </View>;
}

function ReleaseDetails({ update }: { update: UpdateState }) {
  const styles = useStyles();
  useLanguage();
  const result = update.updateCheck;
  if (!result) return null;
  const { release, updateAvailable } = result;
  return <View style={styles.status}>
    <View style={styles.statusHeading}>
      <Text style={styles.statusTitle}>{t("client.mobile.latestVersionV")}{release.version}</Text>
      <Text style={styles.statusLabel}>{updateAvailable ? t("client.mobile.updateAvailable") : t("client.mobile.upToDate")}</Text>
    </View>
    {release.publishedAt ? <Text style={styles.detail}>
      {t("client.mobile.releasedOn")}{' '}{new Date(release.publishedAt).toLocaleDateString(getLocale())}
    </Text> : null}
    {updateAvailable ? <ReleaseNotes text={release.notes} /> : null}
  </View>;
}

export function UpdateDetails({ update }: { update: UpdateState }) {
  const styles = useStyles();
  useLanguage();
  if (!update.error && !update.updateCheck?.updateAvailable && update.downloadState.status === 'idle') return null;
  return <View style={styles.updateDetails}>
    <DownloadStatus update={update} />
    {update.error ? <Text accessibilityRole="alert" style={[styles.detail, styles.error]}>{update.error}</Text> : null}
    <ReleaseDetails update={update} />
  </View>;
}
