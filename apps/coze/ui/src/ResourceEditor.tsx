import { displayError } from './i18n/index';
import { useEffect, useState } from "react";
import { Alert, App, Button, Input, Popconfirm, Space, Tabs, Tag } from "antd";
import { ArrowLeft, Download, Save, Trash2 } from "lucide-react";
import { api, errorText } from "./api";
import type { Draft, Resource } from "./types";
import { msg, useT } from "./i18n";
import { KnowledgePanel } from "./knowledge/KnowledgePanel";
import { AgentEditor } from "./agents/AgentEditor";
import { WorkflowEditor } from "./workflow/WorkflowEditor";
import { TableEditor } from "./TableEditor";
import { ToolEditor } from "./ToolEditor";
import { DraftValidation, useDraftValidation } from "./draftValidation";
import { AppEditor } from "./projects/AppEditor";
import { ReleaseHistory } from "./projects/ReleaseHistory";
import { AccessPanel } from "./projects/AccessPanel";
import { ExternalToolsPanel } from "./external/ExternalToolsPanel";

interface Props {
  resource: Resource; resources: Resource[]; onSaved: (resource: Resource) => void;
  onBack: () => void; onDirty: (dirty: boolean) => void;
  manage?: boolean;
}

export function ResourceEditor({ resource, resources, onSaved, onBack, onDirty, manage = true }: Props) {
  const [name, setName] = useState(resource.name);
  const [description, setDescription] = useState(resource.description);
  const [draft, setDraft] = useState<Draft>(resource.draft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { message } = App.useApp();
  const t = useT();
  const validation = useDraftValidation();
  const dirty = name !== resource.name || description !== resource.description
    || JSON.stringify(draft) !== JSON.stringify(resource.draft);
  const modified = dirty || validation.invalid;
  useEffect(() => onDirty(modified), [modified, onDirty]);
  const save = async (): Promise<Resource> => {
    if (validation.invalid) throw new Error(msg("coze.core.fixTheFieldsMarkedInRedBeforeYouSaveOr"));
    const saved = await api<Resource>("save_resource", { id: resource.id, revision: resource.revision,
      kind: resource.kind, name, description, draft });
    onSaved(saved); return saved;
  };
  const perform = async (operation: () => Promise<void>) => {
    setBusy(true); setError("");
    try { await operation(); } catch (error) { setError(errorText(error)); } finally { setBusy(false); }
  };
  const publish = () => perform(async () => {
    const current = dirty ? await save() : resource;
    onSaved(await api<Resource>("publish", { id: current.id, revision: current.revision, enabled: true }));
    void message.success(t("coze.core.publishedCodexGuiCanUseItNow"));
  });
  const exportResource = () => perform(async () => {
    if (dirty) await save();
    const bundle = await api<unknown>("export_template", { id: resource.id });
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `${name || "coze"}.json`; anchor.click(); URL.revokeObjectURL(url);
  });
  const back = <Button icon={<ArrowLeft size={16} />} onClick={modified ? undefined : onBack}>{t("coze.core.back")}</Button>;
  const workflow = resource.kind === "workflow";
  const descriptionInput = <Input className="resource-description" aria-label={t("coze.core.description")}
    placeholder={t("coze.core.describeWhatItSForToHelpYouAndAi")} value={description}
    maxLength={2000} onChange={(event) => setDescription(event.target.value)} />;
  const releaseStatus = resource.publishedRevision == null
    ? t("coze.core.draftVersionNotPublishedYet", { revision: resource.revision })
    : t("coze.core.draftVersionPublishedVersion",
      { revision: resource.revision, published: resource.publishedRevision });
  return <DraftValidation.Provider value={validation.report}>
    <section className={`resource-editor ${workflow ? "workflow-resource" : ""}`}>
    <header className="editor-header"><Space>
      {modified ? <Popconfirm title={t("coze.core.discardUnsavedChanges")} onConfirm={onBack}
        styles={{ root: { maxWidth: 400 } }}>{back}</Popconfirm> : back}
      <Input aria-label={t("coze.core.name")} value={name} maxLength={100} onChange={(event) => setName(event.target.value)} />
      {resource.mcpEnabled && <Tag color="purple">Codex GUI</Tag>}
    </Space><Space>
      {manage && <Button aria-label={t("coze.core.export")} icon={<Download size={16} />} disabled={validation.invalid || busy}
        onClick={() => void exportResource()} />}
      <Button icon={<Save size={16} />} loading={busy} disabled={!dirty || validation.invalid}
        onClick={() => void perform(async () => { await save(); void message.success(t("coze.core.saved")); })}>{t("coze.core.save")}</Button>
      {manage && ["app", "agent", "workflow", "knowledge", "plugin", "table", "prompt"].includes(resource.kind) &&
        <Button type="primary" loading={busy} disabled={validation.invalid}
          onClick={() => void publish()}>{t("coze.core.publishToCodexGui")}</Button>}
    </Space></header>
    {error && <Alert type="error" message={displayError(error)} closable onClose={() => setError("")} />}
    {!workflow && descriptionInput}
    <Tabs items={[{ key: "edit", label: t("coze.core.editAndPreview"), children: <>
      {resource.kind === "app" && <AppEditor resource={resource} resources={resources}
        draft={draft} onChange={setDraft} save={dirty ? save : undefined} />}
      {resource.kind === "knowledge" && <KnowledgePanel resource={resource} />}
      {resource.kind === "agent" && <AgentEditor resource={resource} resources={resources} draft={draft}
        onChange={setDraft} save={dirty ? save : undefined} />}
      {resource.kind === "workflow" && <WorkflowEditor resource={resource} resources={resources} draft={draft}
        onChange={setDraft} save={dirty || validation.invalid ? save : undefined} />}
      {resource.kind === "prompt" && <Input.TextArea value={String(draft.text ?? "")} rows={20}
        placeholder={t("coze.core.writeAPromptYouCanReuse")} onChange={(event) => setDraft({ text: event.target.value })} />}
      {resource.kind === "table" && <TableEditor resource={resource} />}
      {resource.kind === "plugin" && <ToolEditor resource={resource} draft={draft} onChange={setDraft}
        save={dirty || validation.invalid ? save : undefined} />}
    </> }, ...(manage ? [{ key: "settings", label: t("coze.core.settings"), children: <div className="settings-panel">
      {workflow && <><h3>{t("coze.core.purpose")}</h3>{descriptionInput}</>}
      <h3>{t("coze.core.saveAsTemplate")}</h3><p>{t("coze.core.addTheCurrentSetupAndTheContentItUsesTo")}</p>
      <Button disabled={modified} onClick={() => void perform(async () => {
        const bundle = await api<unknown>("export_template", { id: resource.id });
        await api("save_template", bundle); void message.success(t("coze.core.savedToTheTemplateGallery"));
      })}>{t("coze.core.saveToTemplateGallery")}</Button>
      <h3>{t("coze.core.publishingStatus")}</h3><p>{releaseStatus}</p>
      <ReleaseHistory resource={resource} onSaved={onSaved} />
      {resource.kind === "app" && <AccessPanel appId={resource.id} published={Boolean(resource.publishedRevision)} />}
      <ExternalToolsPanel resource={resource} />
      {resource.mcpEnabled && <Button onClick={() => void perform(async () => {
        onSaved(await api<Resource>("publish", { id: resource.id, revision: resource.revision, enabled: false }));
      })}>{t("coze.core.removeFromCodexGui")}</Button>}
      <h3>{t("coze.core.deleteContent")}</h3><p>{t("coze.core.thisAlsoDeletesRelatedDocumentsConversationsAndRunHistory")}</p>
      <Popconfirm title={t("coze.core.deleteThisCanTBeUndone")} overlayStyle={{ maxWidth: 400 }} onConfirm={() => perform(async () => {
        await api("delete_resource", { id: resource.id, revision: resource.revision }); onBack();
      })}><Button danger icon={<Trash2 size={16} />}>{t("coze.core.delete")}</Button></Popconfirm>
    </div> }] : [])]} />
  </section></DraftValidation.Provider>;
}
