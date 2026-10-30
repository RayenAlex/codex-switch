import { useDeviceScreenControl as useScreenControl } from '../../../../shared/remote-desktop/useDeviceScreenControl';
import { adminRequest } from '../api/client';
import { Toast } from '../components/AppToast';
import { t } from '../i18n';
import type { AuthSession } from '../types';

export function useDeviceScreenControl(session: AuthSession) {
  return useScreenControl({
    scope: JSON.stringify([session.baseUrl, session.email]),
    request: (path, init) => adminRequest(session, path, init),
    notify: (message, failed) => { if (failed) Toast.fail(t(message)); else Toast.success(t(message)); },
  });
}
