import inlineCopy from '@remoteai/i18n/copy/inline/admin/hooks/useUpdateSharingSettings';
import { useCallback, useEffect, useState } from 'react';
import { App, Form } from 'antd';
import type { UpdateSharingPolicy } from '../../../../shared/app-update/sharingPolicy';

export interface UpdateSharingSettingsProps {
  api: <T>(path: string, options?: RequestInit) => Promise<T>;
  canManage: boolean;
}

const ENDPOINT = '/admin/api/update-sharing';

export function useUpdateSharingSettings(api: UpdateSharingSettingsProps['api'], zh: boolean) {
  const [form] = Form.useForm<UpdateSharingPolicy>();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoaded(false);
    void api<UpdateSharingPolicy>(ENDPOINT).then(policy => {
      if (!cancelled) { form.setFieldsValue(policy); setLoaded(true); }
    }).catch(() => {
      if (!cancelled) message.error(zh ? inlineCopy["text_8b704a21"] : inlineCopy["Unable_to_load_download_settings_4a4c4801"]);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [api, form, message, zh, revision]);

  const save = useCallback(async (policy: UpdateSharingPolicy) => {
    setSaving(true);
    try {
      form.setFieldsValue(await api<UpdateSharingPolicy>(ENDPOINT, {
        method: 'PATCH', body: JSON.stringify(policy),
      }));
      message.success(zh ? inlineCopy["text_dfef98e4"] : inlineCopy["Download_settings_saved_1b5020aa"]);
    } catch { message.error(zh ? inlineCopy["text_a5fc967e"] : inlineCopy["Unable_to_save_Please_try_05cd3aad"]); }
    finally { setSaving(false); }
  }, [api, form, message, zh]);

  return { form, loading, loaded, saving, save, reload: () => setRevision(value => value + 1) };
}
