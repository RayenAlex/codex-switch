import { t } from '../i18n';
import { Linking, Platform } from 'react-native';
import { Toast } from '../components/AppToast';
import { startAndroidUpdateDownload, type AppRelease } from './appUpdate';
import { AndroidUpdateCancelled } from './androidUpdateAttempt';

export function openReleasePage(url: string) {
  void Linking.openURL(url).catch(() => Toast.fail(t("client.mobile.couldNotOpenThePageTryAgainLater")));
}

export function beginAppUpdateDownload(release: AppRelease) {
  if (Platform.OS !== 'android' || !release.androidAsset) {
    openReleasePage(release.releaseUrl);
    return;
  }
  Toast.success(t("client.mobile.downloadingTheUpdateYouCanKeepUsingTheApp"));
  void startAndroidUpdateDownload(release).catch(error => {
    if (!(error instanceof AndroidUpdateCancelled)) Toast.fail(t("client.mobile.downloadFailedTryAgainLater"));
  });
}
