import inlineCopy from '@remoteai/i18n/copy/inline/admin/hooks/useHelpSettings';
import defaultQuestionsResource from '@remoteai/i18n/copy/admin/helpQuestions';
import { useEffect, useRef, useState } from "react";
import { App } from "antd";
import type { OfficialModelsProps } from "./useOfficialModels";

export type HelpReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max" | "ultra";
export interface HelpQuestion { zh: string; en: string }
export interface HelpSettings {
  model: string; effort: HelpReasoningEffort; systemPrompt: string; revision: string; questions: HelpQuestion[];
}
const defaultQuestions: HelpQuestion[] = defaultQuestionsResource;
const ENDPOINT = "/admin/api/help-assistant";
const noticeStyle = { maxWidth: 400, whiteSpace: "normal" as const };

export function useHelpSettings(api: OfficialModelsProps["api"], zh: boolean) {
  const { message } = App.useApp();
  const [draft, setDraft] = useState<HelpSettings>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const pending = useRef(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    let current = true;
    setLoading(true);
    void api<HelpSettings>(ENDPOINT).then((settings) => {
      if (current) setDraft({ ...settings, effort: settings.effort ?? "low",
        questions: settings.questions ?? defaultQuestions });
    })
      .catch(() => {
        if (current) message.error({ content: zh ? inlineCopy["text_c8a7d93e"]
          : inlineCopy["Unable_to_load_assistant_settings_ca19fd5b"], style: noticeStyle });
      }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [api, attempt, message, zh]);

  const save = async () => {
    if (pending.current || loading || !draft) return;
    pending.current = true; setSaving(true);
    try {
      const settings = await api<HelpSettings>(ENDPOINT, { method: "PATCH", body: JSON.stringify(draft) });
      if (!active.current) return;
      setDraft(settings);
      message.success({ content: zh ? inlineCopy["text_04f2e0c8"]
        : inlineCopy["Assistant_settings_saved_They_apply_7c956fea"], style: noticeStyle });
    } catch (error) {
      if (active.current) message.error({ content: error instanceof Error ? error.message
        : (zh ? inlineCopy["text_3461df8d"] : inlineCopy["Unable_to_save_Please_retry_aa2c25e7"]), style: noticeStyle });
    } finally {
      pending.current = false; if (active.current) setSaving(false);
    }
  };
  return { draft, setDraft, loading, saving, save, reload: () => setAttempt((value) => value + 1) };
}
