import { t } from '../i18n';
import { useRef } from 'react';
import { Alert } from 'react-native';
import { Toast } from '../components/AppToast';
import { revokeDesktopService } from '../api/client';
import type { AuthSession, RemoteDevice } from '../types';

export function useRevokeDesktopService(session: AuthSession) {
  const busy = useRef(false);
  return (device: RemoteDevice) => {
    if (busy.current) return;
    Alert.alert(t("client.mobile.revokeUnattendedAccess.aee3c8"), t("client.mobile.afterRevokingEnableUnattendedAccessAgainOnTheComputerTo"), [
      { text: t("client.accounts.cancel"), style: 'cancel' },
      { text: t("client.mobile.revokeAccess"), style: 'destructive', onPress: () => {
        if (busy.current) return;
        busy.current = true;
        void revokeDesktopService(session, device.deviceId)
          .then(() => Toast.success(t("client.mobile.unattendedAccessRevoked")))
          .catch(() => Toast.fail(t("client.mobile.couldNotRevokeAccessCheckYourConnectionAndTryAgain")))
          .finally(() => { busy.current = false; });
      } },
    ]);
  };
}
