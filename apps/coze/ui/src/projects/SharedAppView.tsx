import { displayText } from '../i18n/index';
import { useState } from "react";
import { Button, Card, Empty, List, Space, Tag, Typography } from "antd";
import { AgentPreview } from "../agents/AgentPreview";
import { ResourceEditor } from "../ResourceEditor";
import { msg, useKindCopy, useT } from "../i18n";
import type { Resource } from "../types";
import { SharedWorkflow } from "./SharedWorkflow";

export interface AccessInfo { role: string; appId?: string }
interface Props { access: AccessInfo; resources: Resource[]; onSaved: (resource: Resource) => void }
/** Role ids are protocol values; the labels are Chinese sources translated at render. */
const roleLabels: Record<string, string> = { viewer: msg("coze.index.viewOnly"), runner: msg("coze.index.viewAndUse"), editor: msg("coze.index.canEdit") };

export function SharedAppView({ access, resources, onSaved }: Props) {
  const t = useT();
  const copy = useKindCopy();
  const [selected, setSelected] = useState<string>();
  const resource = resources.find((item) => item.id === selected);
  const app = resources.find((item) => item.id === access.appId);
  const entry = resources.find((item) => item.id === app?.draft.entryId);
  if (!app) return <Empty description={t("coze.index.thisAppIsnTAvailableRightNowContactThePerson")} />;
  if (resource && access.role === "editor") return <ResourceEditor key={resource.id} resource={resource}
    resources={resources} manage={false} onSaved={onSaved} onBack={() => setSelected(undefined)} onDirty={() => undefined} />;
  return <main className="studio-main">
    <header className="collection-header"><div><h1>{app.name}</h1>
      <Typography.Paragraph>{app.description || t("coze.index.welcomeToThisApp")}</Typography.Paragraph></div>
      <Tag>{displayText(roleLabels[access.role] ?? msg("coze.index.sharedAccess"))}</Tag></header>
    {access.role !== "viewer" && entry?.kind === "agent" &&
      <AgentPreview resource={entry} draft={entry.draft} published />}
    {access.role !== "viewer" && entry?.kind === "workflow" && <SharedWorkflow resourceId={entry.id} />}
    <Card title={t("coze.index.appContent")} style={{ marginTop: 20 }}>
      <List dataSource={resources.filter((item) => item.kind !== "app")} renderItem={(item) =>
        <List.Item actions={access.role === "editor" ? [<Button key="edit" onClick={() => setSelected(item.id)}>
          {t("coze.index.edit")}</Button>] : []}>
          <List.Item.Meta title={<Space>{item.name}<Tag>{copy[item.kind].item}</Tag></Space>}
            description={item.description || t("coze.index.partOfThisApp")} />
        </List.Item>} />
    </Card>
  </main>;
}
