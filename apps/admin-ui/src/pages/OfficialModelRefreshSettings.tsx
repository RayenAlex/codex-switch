import inlineCopy from '@remoteai/i18n/copy/inline/admin/pages/OfficialModelRefreshSettings';
import { interpolate as interpolateCopy } from '@remoteai/i18n';
import { Button, Card, InputNumber, Space, Switch, Tag, Typography } from "antd";
import { MAX_MODEL_REFRESH_MINUTES, useModelRefreshSettings } from "../hooks/useModelRefreshSettings";
import type { OfficialModelsProps } from "../hooks/useOfficialModels";

export function OfficialModelRefreshSettings({ api, canManage, zh }: OfficialModelsProps & { zh: boolean }) {
  const settings = useModelRefreshSettings(api, zh);
  const busy = settings.loading || settings.saving;
  const editable = canManage && !busy && Boolean(settings.saved);
  return <Card title={zh ? inlineCopy["text_736cff23"] : inlineCopy["Automatic_updates_147b1b68"]} loading={settings.loading}
    extra={<Button disabled={busy} onClick={settings.reload}>{zh ? inlineCopy["text_fbaf301e"] : inlineCopy["Reload_settings_7b9e42ee"]}</Button>}>
    {settings.saved && <Typography.Paragraph>
      <Tag color={settings.saved.enabled ? "green" : "default"}>{settings.saved.enabled
        ? (zh ? interpolateCopy(inlineCopy["value1_f6dbb225"], { value1: String(settings.saved.intervalMinutes) }) : interpolateCopy(inlineCopy["Every_value1_minutes_7d352e13"], { value1: String(settings.saved.intervalMinutes) }))
        : (zh ? inlineCopy["text_6744b4c6"] : inlineCopy["Off_ca7981b4"])}</Tag>
    </Typography.Paragraph>}
    <Typography.Paragraph type="secondary">{zh
      ? inlineCopy["text_2f14ae77"]
      : inlineCopy.descriptionEn}
    </Typography.Paragraph>
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Space wrap><Typography.Text>{zh ? inlineCopy["text_49f5f2ea"] : inlineCopy["Update_automatically_9e946306"]}</Typography.Text>
        <Switch aria-label={zh ? inlineCopy["text_49f5f2ea"] : inlineCopy["Update_automatically_9e946306"]} checked={settings.enabled}
          disabled={!editable} onChange={settings.setEnabled} />
      </Space>
      <Space wrap><Typography.Text>{zh ? inlineCopy["text_f055c713"] : inlineCopy["Update_interval_87441a4c"]}</Typography.Text>
        <InputNumber aria-label={zh ? inlineCopy["text_fba7bfd0"] : inlineCopy["Update_interval_minutes_780e8984"]} value={settings.intervalMinutes}
          min={1} max={MAX_MODEL_REFRESH_MINUTES} step={1} addonAfter={zh ? inlineCopy["text_bd957bc4"] : inlineCopy["minutes_90e63d85"]}
          disabled={!editable || !settings.enabled} onChange={settings.setIntervalMinutes} style={{ width: 210 }} />
      </Space>
      <Typography.Text type="secondary">{zh
        ? inlineCopy["1_7_593202ea"]
        : inlineCopy["Choose_1_minute_to_7_9a39c840"]}
      </Typography.Text>
      {canManage && <Button type="primary" loading={settings.saving}
        disabled={!editable || !settings.valid || !settings.dirty} onClick={() => void settings.save()}>
        {zh ? inlineCopy["text_aa6c9cd4"] : inlineCopy["Save_update_settings_752f2158"]}</Button>}
    </Space>
  </Card>;
}
