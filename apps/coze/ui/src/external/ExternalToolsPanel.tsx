import { displayError } from '../i18n/index';
import { useEffect, useState } from "react";
import { Alert, Button, Input, InputNumber, List, Popconfirm, Select, Space, Tag, Typography } from "antd";
import { formatDate, useT } from "../i18n";
import type { Resource } from "../types";
import { ConnectionExamples } from "./ConnectionExamples";
import { useExternalTools, type ToolSettings } from "./useExternalTools";

export function ExternalToolsPanel({ resource }: { resource: Resource }) {
  const t = useT();
  const tools = useExternalTools(resource.id);
  const [settings, setSettings] = useState<ToolSettings>({ enabled: false, mode: "local", port: 15461 });
  const [name, setName] = useState("");
  const [days, setDays] = useState(30);
  useEffect(() => { if (tools.status) setSettings(tools.status.settings); }, [tools.status]);
  const published = resource.mcpEnabled && Boolean(resource.publishedRevision);
  const enabled = tools.status?.settings.enabled === true;
  // One translated sentence; the bold mention is placed where the translation puts {mention}.
  const [beforeMention, afterMention = ""] = t("coze.agents.typeInCodexGuiAndSelectItToUseIt").split("{mention}");
  return <section className="panel">
    <h2>{t("coze.agents.externalAccess")}</h2>
    <p>{t("coze.agents.letOtherAppsUseThisContentThroughMcpOrThe")}</p>
    <p>{beforeMention}<strong>#{resource.name}</strong>{afterMention}</p>
    {tools.error && <Alert type="error" message={displayError(tools.error)} closable onClose={() => tools.setError("")} />}
    <h3>{t("coze.agents.connectionScope")}</h3><p>{t("coze.agents.thisSettingAppliesToAllCozeContentSharedFromThis")}</p>
    <Space wrap>
      <Select aria-label={t("coze.agents.connectionScope")} value={settings.mode} disabled={enabled || tools.busy}
        style={{ minWidth: 200 }} onChange={(mode) => setSettings({ ...settings, mode })}
        options={[{ value: "local", label: t("coze.agents.appsOnThisComputerOnly") }, { value: "network", label: t("coze.agents.allowOtherComputers") }]} />
      <InputNumber aria-label={t("coze.agents.accessPort")} min={1024} max={65535} value={settings.port}
        disabled={enabled || tools.busy} addonBefore={t("coze.agents.port")}
        onChange={(port) => setSettings({ ...settings, port: port ?? 15461 })} />
      {enabled ? <Popconfirm title={t("coze.agents.pauseAllExternalAccess")} styles={{ root: { maxWidth: 400 } }}
        onConfirm={() => tools.configure({ ...settings, enabled: false })}>
        <Button loading={tools.busy}>{t("coze.agents.turnOffExternalAccess")}</Button>
      </Popconfirm> : <Button type="primary" disabled={!tools.status} loading={tools.busy}
        onClick={() => void tools.configure({ ...settings, enabled: true })}>{t("coze.agents.turnOnExternalAccess")}</Button>}
    </Space>
    {settings.mode === "network" && <p>
      {t("coze.agents.otherComputersMustBeAbleToReachThisComputerS")}</p>}
    <h3>{t("coze.agents.accessKeys")}</h3>
    {!published && <Alert type="info" message={t("coze.agents.publishThisContentBeforeYouCreateAnAccessKey")} />}
    <Space wrap>
      <Input aria-label={t("coze.agents.keyPurpose")} value={name} maxLength={80} placeholder={t("coze.agents.appNameOrPurpose")}
        style={{ width: 200 }} onChange={(event) => setName(event.target.value)} />
      <InputNumber aria-label={t("coze.agents.keyValidityInDays")} min={1} max={365} value={days} addonAfter={t("coze.agents.days")}
        onChange={(value) => setDays(value ?? 30)} />
      <Button disabled={!published || !name.trim()} loading={tools.busy}
        onClick={() => void tools.issue(name, days)}>{t("coze.agents.createKey")}</Button>
    </Space>
    {tools.issued && <Alert type="success" message={t("coze.agents.thisKeyIsShownOnlyOnceCopyAndSaveIt")}
      closable onClose={tools.clearIssued} description={<Typography.Paragraph
        copyable={{ text: tools.issued.token }} style={{ overflowWrap: "anywhere", marginBottom: 0 }}>
        {tools.issued.token}</Typography.Paragraph>} />}
    <List dataSource={tools.items} locale={{ emptyText: t("coze.agents.noAccessKeysYet") }} renderItem={(item) => {
      const expired = new Date(item.expiresAt).getTime() <= Date.now();
      return <List.Item actions={[<Button key="revoke" danger size="small"
        disabled={!!item.revokedAt || tools.busy} onClick={() => void tools.revoke(item.id)}>
        {item.revokedAt ? t("coze.agents.revoked") : t("coze.agents.revoke")}</Button>]}>
        <List.Item.Meta title={<Space>{item.name}{expired && <Tag>{t("coze.agents.expired")}</Tag>}</Space>}
          description={t("coze.agents.validUntil", { date: formatDate(item.expiresAt) })} />
      </List.Item>;
    }} />
    <ConnectionExamples resource={resource} urls={tools.status?.urls ?? []} token={tools.issued?.token} />
  </section>;
}
