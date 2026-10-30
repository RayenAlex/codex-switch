import { displayError } from '../i18n/index';
import { useEffect, useState } from "react";
import { Alert, Button, Input, InputNumber, Select, Slider, Space } from "antd";
import { api, errorText } from "../api";
import { useT } from "../i18n";
import type { Draft, Model, Resource } from "../types";

interface Props { resources: Resource[]; draft: Draft; onChange: (draft: Draft) => void }

export function AgentSettings({ resources, draft, onChange }: Props) {
  const t = useT();
  const [models, setModels] = useState<Model[]>([]);
  const [error, setError] = useState("");
  const refresh = () => api<Model[]>("models").then(setModels)
    .catch((error: unknown) => setError(errorText(error)));
  useEffect(() => { void refresh(); }, []);
  const update = (key: string, value: Draft[string]) => onChange({ ...draft, [key]: value });
  const toolIds = (draft.toolIds ?? []) as string[];
  const available = resources.filter((item) => ["workflow", "plugin", "knowledge", "table"].includes(item.kind));
  return <section className="panel"><h2>{t("coze.agents.roleAndCapabilities")}</h2>
    {error && <Alert type="error" message={displayError(error)} closable onClose={() => setError("")} />}
    <label>{t("coze.agents.model")}</label><Space.Compact block>
      <Select className="grow" showSearch value={String(draft.model || "") || undefined}
        placeholder={t("coze.agents.chooseARemoteAiModel")} options={models.map((model) => ({ value: model.id, label: model.name }))}
        onChange={(value) => update("model", value)} />
      <Button onClick={() => void refresh()}>{t("coze.agents.refresh")}</Button>
    </Space.Compact>
    <label>{t("coze.agents.systemPrompt")}</label><Input.TextArea rows={9} value={String(draft.prompt ?? "")}
      onChange={(event) => update("prompt", event.target.value)} placeholder={t("coze.agents.describeItsRoleTasksAndHowItShouldAnswer")} />
    <Select className="full" placeholder={t("coze.agents.insertFromPrompts")} value={undefined}
      options={resources.filter((item) => item.kind === "prompt").map((item) => ({ value: item.id, label: item.name }))}
      onChange={(id) => update("prompt", `${String(draft.prompt ?? "")}\n${String(
        resources.find((item) => item.id === id)?.draft.text ?? "")}`)} />
    <label>{t("coze.agents.knowledgeBasesToCheckBeforeAnswering")}</label><Select mode="multiple" className="full" placeholder={t("coze.agents.chooseKnowledgeBases")}
      value={(draft.knowledgeIds ?? []) as string[]} onChange={(value) => update("knowledgeIds", value)}
      options={resources.filter((item) => item.kind === "knowledge").map((item) => ({ value: item.id, label: item.name }))} />
    <label>{t("coze.agents.toolsItCanCallOnItsOwn")}</label><Select mode="multiple" className="full"
      placeholder={t("coze.agents.choosePublishedWorkflowsToolsOrData")}
      value={toolIds} onChange={(value: string[]) => onChange({ ...draft, toolIds: value,
        writableTableIds: ((draft.writableTableIds ?? []) as string[]).filter((id) => value.includes(id)) })}
      options={available.map((item) => ({
        value: item.id, label: item.publishedRevision ? item.name : t("coze.agents.notPublished", { name: item.name }),
        disabled: !item.publishedRevision }))} />
    <label>{t("coze.agents.tablesItCanChange")}</label><Select mode="multiple" className="full" placeholder={t("coze.agents.readOnlyByDefault")}
      value={(draft.writableTableIds ?? []) as string[]} onChange={(value) => update("writableTableIds", value)}
      options={available.filter((item) => item.kind === "table" && toolIds.includes(item.id))
        .map((item) => ({ value: item.id, label: item.name }))} />
    <Space wrap><div><label>{t("coze.agents.maxToolCallRounds")}</label><InputNumber min={1} max={20} value={Number(draft.maxSteps ?? 8)}
      onChange={(value) => update("maxSteps", value ?? 8)} /></div>
      <div><label>{t("coze.agents.recentTurnsToRemember")}</label><InputNumber min={0} max={40} value={Number(draft.memoryTurns ?? 20)}
        onChange={(value) => update("memoryTurns", value ?? 20)} /></div></Space>
    <label>{t("coze.agents.responseCreativity")}</label><Slider min={0} max={2} step={0.1} value={Number(draft.temperature ?? 0.7)}
      onChange={(value) => update("temperature", value)} />
  </section>;
}
