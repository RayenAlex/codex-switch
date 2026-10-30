import inlineCopy from '@remoteai/i18n/copy/inline/admin/hooks/useModelRefreshSettings';
import { useEffect, useRef, useState } from "react";
import { App } from "antd";
import type { OfficialModelsProps } from "./useOfficialModels";

export interface ModelRefreshSettings { enabled: boolean; intervalMinutes: number; revision: string }
export const MAX_MODEL_REFRESH_MINUTES = 10080;
const ENDPOINT = "/admin/api/official-models/settings";
const noticeStyle = { maxWidth: 400, whiteSpace: "normal" as const };

export function useModelRefreshSettings(api: OfficialModelsProps["api"], zh: boolean) {
  const { message } = App.useApp();
  const [saved, setSaved] = useState<ModelRefreshSettings>();
  const [enabled, setEnabled] = useState(true);
  const [intervalMinutes, setIntervalMinutes] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const pending = useRef(false);
  const active = useRef(true);
  const accept = (settings: ModelRefreshSettings) => {
    setSaved(settings); setEnabled(settings.enabled); setIntervalMinutes(settings.intervalMinutes);
  };
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    let current = true;
    setLoading(true);
    void api<ModelRefreshSettings>(ENDPOINT).then((settings) => { if (current) accept(settings); })
      .catch(() => {
        if (current) message.error({ content: zh ? inlineCopy["text_e70d0fd2"]
          : inlineCopy["Unable_to_load_automatic_update_7a8c0294"], style: noticeStyle });
      }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [api, attempt, message, zh]);

  const valid = intervalMinutes !== null && Number.isInteger(intervalMinutes)
    && intervalMinutes >= 1 && intervalMinutes <= MAX_MODEL_REFRESH_MINUTES;
  const dirty = Boolean(saved && (saved.enabled !== enabled || saved.intervalMinutes !== intervalMinutes));
  const save = async () => {
    if (pending.current || loading || !saved || !valid || !dirty) return;
    pending.current = true; setSaving(true);
    try {
      const settings = await api<ModelRefreshSettings>(ENDPOINT, { method: "PATCH",
        body: JSON.stringify({ enabled, intervalMinutes, revision: saved.revision }) });
      if (!active.current) return;
      accept(settings);
      message.success({ content: zh ? inlineCopy["text_21bc23a7"] : inlineCopy["Automatic_update_settings_saved_fc0e2357"], style: noticeStyle });
    } catch (error) {
      if (active.current) message.error({ content: error instanceof Error ? error.message
        : (zh ? inlineCopy["text_3461df8d"] : inlineCopy["Unable_to_save_Please_retry_aa2c25e7"]), style: noticeStyle });
    } finally {
      pending.current = false; if (active.current) setSaving(false);
    }
  };
  const changeEnabled = (value: boolean) => {
    setEnabled(value);
    if (!value && !valid && saved) setIntervalMinutes(saved.intervalMinutes);
  };
  return { saved, enabled, setEnabled: changeEnabled, intervalMinutes, setIntervalMinutes,
    loading, saving, valid, dirty, save,
    reload: () => setAttempt((value) => value + 1) };
}
