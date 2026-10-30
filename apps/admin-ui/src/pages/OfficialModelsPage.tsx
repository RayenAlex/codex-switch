import inlineCopy from '@remoteai/i18n/copy/inline/admin/pages/OfficialModelsPage';
import { interpolate as interpolateCopy } from '@remoteai/i18n';
import { Button, Card, Space, Tag, Typography } from "antd";
import { useI18n } from "../i18n-context";
import { useOfficialModels, type OfficialModelsProps } from "../hooks/useOfficialModels";
import { HelpAssistantSettings } from "./HelpAssistantSettings";
import { OfficialModelRefreshSettings } from "./OfficialModelRefreshSettings";
import { CatalogEditor } from "./official-models/CatalogEditor";

export function OfficialModelsPage({ api, canManage }: OfficialModelsProps) {
  const { language } = useI18n();
  const zh = language === "zh";
  const models = useOfficialModels(api, zh);
  const busy = models.loading || models.action !== null;
  const catalog = models.snapshot?.catalog;
  const count = models.parsed.catalog?.models.length ?? 0;
  return <Space direction="vertical" size="large" style={{ width: "100%" }}>
    <div>
      <Typography.Title level={2}>{zh ? inlineCopy["text_8f20d40d"] : inlineCopy["Official_models_ab876363"]}</Typography.Title>
      <Typography.Paragraph type="secondary">{zh
        ? inlineCopy["Codex_GUI_504d9486"]
        : inlineCopy["The_proxy_and_Codex_GUI_a387b0ed"]}
      </Typography.Paragraph>
      <Typography.Paragraph type="secondary">{zh
        ? inlineCopy["text_1c3479a0"]
        : inlineCopy["Saved_changes_apply_the_next_1f92a43f"]}
      </Typography.Paragraph>
    </div>
    <OfficialModelRefreshSettings api={api} canManage={canManage} zh={zh} />
    <HelpAssistantSettings api={api} canManage={canManage} catalog={catalog} zh={zh} />
    <Card loading={models.loading}>
      <Space wrap style={{ marginBottom: 16 }}>
        <Tag>{zh ? interpolateCopy(inlineCopy["value1_15d15b04"], { value1: String(count) }) : interpolateCopy(inlineCopy["value1_models_dee84b9b"], { value1: String(count) })}</Tag>
        {catalog && <Typography.Text type="secondary">
          {zh ? inlineCopy["text_ccc10870"] : inlineCopy["Updated_4d42f9f4"]}{new Date(models.snapshot!.updatedAt).toLocaleString()}
        </Typography.Text>}
        <Button disabled={busy} onClick={models.reload}>{zh ? inlineCopy["text_7bdd5ce1"] : inlineCopy["Reload_bdc090ec"]}</Button>
        {canManage && <Button loading={models.action === "refresh"} disabled={busy || !models.snapshot}
          onClick={() => void models.submit("refresh")}>{zh ? inlineCopy["text_4ecf53e1"] : inlineCopy["Refresh_from_official_service_d0ae9c48"]}</Button>}
      </Space>
      {!catalog && <Typography.Paragraph type="secondary">{zh
        ? inlineCopy["text_38fe0307"]
        : inlineCopy["No_model_list_yet_Refresh_4e92bd95"]}
      </Typography.Paragraph>}
      <CatalogEditor draft={models.draft} onChange={models.setDraft} parsed={models.parsed}
        disabled={!canManage || busy || !models.snapshot} canManage={canManage} zh={zh} />
      {canManage && <Button type="primary" style={{ marginTop: 16 }} loading={models.action === "save"}
        disabled={busy || !models.snapshot || Boolean(models.parsed.error)} onClick={() => void models.submit("save")}>
        {zh ? inlineCopy["text_991bb7cf"] : inlineCopy["Save_changes_dd0ae7a5"]}
      </Button>}
    </Card>
  </Space>;
}
