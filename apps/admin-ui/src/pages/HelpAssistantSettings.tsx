import inlineCopy from '@remoteai/i18n/copy/inline/admin/pages/HelpAssistantSettings';
import { Button, Card, Input, Select, Space, Typography } from "antd";
import { useHelpSettings } from "../hooks/useHelpSettings";
import type { OfficialModelsProps } from "../hooks/useOfficialModels";
import { HelpReasoningField } from "./HelpReasoningField";
import { HelpQuestionsField } from "./HelpQuestionsField";

function modelOptions(catalog: Record<string, unknown> | null | undefined) {
  const models: unknown[] = Array.isArray(catalog?.models) ? catalog.models : [];
  return models.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const model = entry as Record<string, unknown>;
    const value = typeof model.slug === "string" && model.slug ? model.slug : model.id;
    if (typeof value !== "string" || !value.trim() || model.visibility === "hide") return [];
    return [{ value: value.trim(), label: value.trim() }];
  });
}

export function HelpAssistantSettings({ api, canManage, catalog, zh }: OfficialModelsProps & {
  catalog: Record<string, unknown> | null | undefined; zh: boolean;
}) {
  const settings = useHelpSettings(api, zh);
  const options = modelOptions(catalog);
  const busy = settings.loading || settings.saving;
  const editable = canManage && !busy && Boolean(settings.draft);
  const validModel = options.some((option) => option.value === settings.draft?.model);
  return <Card title={zh ? inlineCopy["text_6c11196b"] : inlineCopy["Help_assistant_03ad1405"]} loading={settings.loading}
    extra={<Button disabled={busy} onClick={settings.reload}>{zh ? inlineCopy["text_7bdd5ce1"] : inlineCopy["Reload_bdc090ec"]}</Button>}>
    <Typography.Paragraph type="secondary">{zh
      ? inlineCopy["Codex_57a711d3"]
      : inlineCopy.descriptionEn}
    </Typography.Paragraph>
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <div><Typography.Paragraph>{zh ? inlineCopy["text_3a3ab887"] : inlineCopy["Assistant_model_7c8dbb91"]}</Typography.Paragraph>
        <Select aria-label={zh ? inlineCopy["text_3a3ab887"] : inlineCopy["Assistant_model_7c8dbb91"]} showSearch optionFilterProp="label"
          style={{ width: "100%", maxWidth: 400 }} disabled={!editable} options={options}
          value={settings.draft?.model || undefined}
          placeholder={zh ? inlineCopy["text_583db158"] : inlineCopy["Choose_a_cached_official_model_ac768bb4"]}
          onChange={(model: string) => settings.setDraft((draft) => draft && { ...draft, model })} />
        {!options.length && <Typography.Paragraph type="secondary">{zh
          ? inlineCopy["text_9b673254"] : inlineCopy["Update_the_official_model_list_cfe00d84"]}</Typography.Paragraph>}
        {settings.draft?.model && !validModel && <Typography.Paragraph type="warning">{zh
          ? inlineCopy["text_bfef7f51"]
          : inlineCopy["The_saved_model_is_no_253b2155"]}
        </Typography.Paragraph>}
      </div>
      <HelpReasoningField value={settings.draft?.effort} disabled={!editable} zh={zh}
        onChange={(effort) => settings.setDraft((draft) => draft && { ...draft, effort })} />
      <div><Typography.Paragraph>{zh ? inlineCopy["text_0894b78b"] : inlineCopy["System_instructions_f83a6ca7"]}</Typography.Paragraph>
        <Input.TextArea aria-label={zh ? inlineCopy["text_0894b78b"] : inlineCopy["System_instructions_f83a6ca7"]}
          value={settings.draft?.systemPrompt ?? ""}
          readOnly={!canManage} disabled={busy || !settings.draft} maxLength={16000} autoSize={{ minRows: 5, maxRows: 12 }}
          onChange={(event) => settings.setDraft((draft) => draft && { ...draft, systemPrompt: event.target.value })} />
      </div>
      <HelpQuestionsField value={settings.draft?.questions ?? []} disabled={!editable} zh={zh}
        onChange={(questions) => settings.setDraft((draft) => draft && { ...draft, questions })} />
      {canManage && <Button type="primary" loading={settings.saving}
        disabled={!editable || !validModel || !settings.draft?.systemPrompt.trim()
          || settings.draft.questions.some((question) => !question.zh.trim() && !question.en.trim())}
        onClick={() => void settings.save()}>
        {zh ? inlineCopy["text_d074a286"] : inlineCopy["Save_assistant_settings_5f60f7df"]}</Button>}
    </Space>
  </Card>;
}
