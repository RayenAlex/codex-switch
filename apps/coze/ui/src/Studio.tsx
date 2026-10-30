import { displayError } from './i18n/index';
import { useCallback, useEffect, useState } from "react";
import { Alert, App, Button, Dropdown, Empty, Input, Modal, Spin, Upload } from "antd";
import { Bot, BookOpen, Database, FileText, GitBranch, Plus, Search, Wrench, Boxes } from "lucide-react";
import { api, errorText } from "./api";
import { defaultDraft, type Kind, type Resource } from "./types";
import { msg, useKindCopy, useT } from "./i18n";
import { ResourceEditor } from "./ResourceEditor";
import { BackupButton } from "./projects/BackupButton";
import { TemplateLibrary } from "./projects/TemplateLibrary";
import { SharedAppView } from "./projects/SharedAppView";
import { StopCozeButton } from "./StopCozeButton";

const icons = { app: Boxes, agent: Bot, workflow: GitBranch, knowledge: BookOpen,
  prompt: FileText, table: Database, plugin: Wrench };
const kinds: Kind[] = ["app", "agent", "workflow", "knowledge", "prompt", "table", "plugin"];

export function Studio() {
  const { message, modal } = App.useApp();
  const t = useT();
  const copy = useKindCopy();
  const [resources, setResources] = useState<Resource[]>([]);
  const [selected, setSelected] = useState<Resource>();
  const [kind, setKind] = useState<Kind>("agent");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<Kind>();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [access, setAccess] = useState<{ role: string; appId?: string }>();
  const refresh = useCallback(async () => {
    try { setResources(await api<Resource[]>("list_resources")); setError(""); }
    catch (error) { setError(errorText(error)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    let active = true;
    void api<{ role: string; appId?: string }>("access_info")
      .then((value) => { if (active) setAccess(value); })
      .catch((error: unknown) => { if (active) setError(errorText(error)); });
    return () => { active = false; };
  }, []);
  const saved = (resource: Resource) => {
    setSelected(resource);
    setResources((previous) => [resource, ...previous.filter((item) => item.id !== resource.id)]);
  };
  const create = async () => {
    if (!creating || !name.trim()) return;
    setBusy(true);
    try {
      const resource = await api<Resource>("save_resource", {
        kind: creating, name, description: "", draft: defaultDraft(creating, t),
      });
      setKind(creating); saved(resource); setCreating(undefined); setName("");
    } catch (error) { setError(errorText(error)); }
    finally { setBusy(false); }
  };
  const filtered = resources.filter((item) => item.kind === kind
    && `${item.name} ${item.description}`.toLowerCase().includes(search.toLowerCase()));
  const navigate = (item: Kind) => {
    const go = () => { setKind(item); setSelected(undefined); setDirty(false); };
    if (dirty) modal.confirm({ title: t("coze.core.discardUnsavedChanges"), width: 400, onOk: go,
      okText: t("coze.core.discardChanges"), cancelText: t("coze.core.keepEditing") });
    else go();
  };
  const importResource = async (file: File) => {
    try {
      if (file.size > 4 * 1024 * 1024) throw new Error(msg("coze.core.chooseAnExportFileOf4MbOrLess"));
      const value: unknown = JSON.parse(await file.text());
      if (value && typeof value === "object" && "format" in value && value.format === "remoteai-coze-template") {
        const template = await api<{id: string}>("save_template",value);
        const installed = await api<{entryId: string}>("install_template",{id:template.id});
        await refresh();
        const imported = await api<Resource>("get_resource",{id:installed.entryId});
        setKind(imported.kind); saved(imported); return;
      }
      if (!value || typeof value !== "object" || !("format" in value) || value.format !== "remoteai-coze"
        || !("resource" in value)) throw new Error(msg("coze.core.chooseAFileExportedFromRemoteAiCoze"));
      const resource = value.resource as Resource;
      if (!kinds.includes(resource.kind)) throw new Error(msg("coze.core.theContentTypeInThisFileIsnTSupportedYet"));
      const imported = await api<Resource>("save_resource", { kind: resource.kind, name: resource.name,
        description: resource.description, draft: resource.draft });
      setKind(imported.kind); saved(imported);
    } catch (error) { setError(errorText(error)); }
  };
  if (!access) return <main className="studio-main">{error ? <Alert type="error" message={displayError(error)} /> : <Spin />}</main>;
  if (access.role !== "owner") return <main className="studio-main">
    {error && <Alert type="error" message={displayError(error)} />}
    <SharedAppView access={access} resources={resources} onSaved={saved} />
  </main>;
  return <div className={`studio ${selected?.kind === "workflow" ? "studio-workflow" : ""}`}>
    <aside className="studio-nav" aria-label={t("coze.core.cozeNavigation")}>
      <header className="studio-brand"><div className="brand"><span>C</span><strong>Coze</strong></div>
        <small>{t("coze.core.yourAiStudio")}</small></header>
      <nav className="studio-nav-items" aria-label={t("coze.core.studio")}>{kinds.map((item) => {
        const Icon = icons[item];
        return <button key={item} className={`studio-nav-button ${kind === item ? "selected" : ""}`}
          aria-label={copy[item].section} aria-current={kind === item ? "page" : undefined}
          onClick={() => navigate(item)}><Icon size={18} /><span>{copy[item].section}</span></button>;
      })}</nav>
      <div className="studio-nav-footer"><BackupButton onRestored={() => { setSelected(undefined); void refresh(); }} />
      <TemplateLibrary onInstalled={(id) => { void refresh();
        if (dirty) { void message.success(t("coze.core.createdFromTheTemplateYourCurrentChangesAreKept")); return; }
        void api<Resource>("get_resource", { id }).then((resource) => { setKind(resource.kind); saved(resource); })
          .catch((error: unknown) => setError(errorText(error))); }} />
      <StopCozeButton />
      </div>
    </aside>
    <main className="studio-main">
      {error && <Alert type="error" message={displayError(error)} closable onClose={() => setError("")} />}
      {selected ? <ResourceEditor key={selected.id} resource={selected} resources={resources}
        onSaved={saved} onDirty={setDirty} onBack={() => { setSelected(undefined); setDirty(false); void refresh(); }} /> : <>
        <header className="collection-header"><div><h1>{copy[kind].section}</h1>
          <p>{kind === "knowledge" ? t("coze.core.turnFilesIntoKnowledgeYouCanSearchAndCite") : t("coze.core.turnIdeasIntoAiCapabilitiesYouCanUseAgainAnd")}</p></div>
          <div className="collection-actions"><Upload accept=".json" showUploadList={false}
            beforeUpload={(file) => { void importResource(file); return false; }}><Button>{t("coze.core.import")}</Button></Upload>
          <Dropdown menu={{ items: kinds.map((key) => ({ key, label: copy[key].create })),
            onClick: ({ key }) => setCreating(key as Kind) }}>
            <Button type="primary" icon={<Plus size={16} />} onClick={() => setCreating(kind)}>{copy[kind].create}</Button>
          </Dropdown>
          </div>
        </header>
        <Input className="resource-search" prefix={<Search size={16} />} placeholder={t("coze.core.searchByNameOrDescription")}
          value={search} onChange={(event) => setSearch(event.target.value)} allowClear />
        {loading ? <Spin /> : filtered.length === 0 ? <Empty description={copy[kind].empty}>
          <Button onClick={() => setCreating(kind)}>{copy[kind].first}</Button></Empty> :
          <div className="resource-grid">{filtered.map((resource) => {
            const Icon = icons[resource.kind];
            return <button key={resource.id} className="resource-card" onClick={() => setSelected(resource)}>
              <div className="resource-icon"><Icon size={24} /></div><strong>{resource.name}</strong>
              <p>{resource.description || t("coze.core.addADescriptionSoItSEasierToFindLater")}</p>
              <small>{resource.mcpEnabled ? t("coze.core.connectedToCodexGui") : t("coze.core.onlyVisibleToYou")}</small>
            </button>;
          })}</div>}
      </>}
    </main>
    <Modal title={copy[creating ?? kind].create} open={Boolean(creating)} onCancel={() => setCreating(undefined)}
      onOk={() => void create()} confirmLoading={busy} okText={t("coze.core.create")} cancelText={t("coze.core.cancel")} width={400}>
      <Input autoFocus aria-label={t("coze.core.name")} placeholder={t("coze.core.giveItAName")} maxLength={100}
        value={name} onChange={(event) => setName(event.target.value)} onPressEnter={() => void create()} />
    </Modal>
  </div>;
}
