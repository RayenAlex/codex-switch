import { displayError } from '../i18n/index';
import { useEffect, useState } from "react";
import { Alert, Button, Empty, Modal, Popconfirm, Space, Upload } from "antd";
import { LayoutTemplate, Upload as UploadIcon } from "lucide-react";
import { api, errorText } from "../api";
import { msg, useLanguage, useT } from "../i18n";

interface Template { id: string; name: string; description: string; builtin: boolean }
export function TemplateLibrary({ onInstalled }: { onInstalled: (id: string) => void }) {
  const t = useT();
  const language = useLanguage();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Template[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const refresh = async () => setItems(await api<Template[]>("list_templates"));
  useEffect(() => {
    if (open) void refresh().catch((error: unknown) => setError(errorText(error)));
  }, [open]);
  const perform = async (task: () => Promise<void>) => {
    setBusy(true); setError("");
    try { await task(); } catch (error) { setError(errorText(error)); } finally { setBusy(false); }
  };
  // The runtime writes a built-in template's names and prompt in the requested language.
  const install = (id: string) => perform(async () => {
    const result = await api<{ entryId: string }>("install_template", { id, language });
    setOpen(false); onInstalled(result.entryId);
  });
  const download = (id: string) => perform(async () => {
    const bundle = await api<unknown>("get_template", { id, language });
    const url = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "coze-template.json";
    anchor.click(); URL.revokeObjectURL(url);
  });
  const upload = (file: File) => {
    void perform(async () => {
      if (file.size > 4 * 1024 * 1024) throw new Error(msg("coze.index.chooseATemplateFileOf4MbOrLess"));
      const value: unknown = JSON.parse(await file.text());
      await api("save_template", value); await refresh();
    });
    return false;
  };
  // Built-in entries arrive in Chinese from the runtime; user templates are user data and stay as written.
  const shown = (item: Template, text: string) => item.builtin ? displayError(text) : text;
  return <><button className="studio-nav-button" aria-label={t("coze.index.templateGallery")} onClick={() => setOpen(true)}>
    <LayoutTemplate size={18} /><span>{t("coze.index.templateGallery")}</span></button>
    <Modal className="studio-dialog" title={t("coze.index.templateGallery")} width={760} open={open} centered
      footer={null} onCancel={() => setOpen(false)}>
      <div className="template-library-intro"><div><p>{t("coze.index.startFromATemplateAndBringYourIdeasToLife")}</p>
        <small>{t("coze.index.templatesIncludeReusableSettingsButNotPrivateDocumentsOrConversations")}</small></div>
        <Upload accept=".json" beforeUpload={upload} showUploadList={false} disabled={busy}>
          <Button icon={<UploadIcon size={16} />} disabled={busy}>{t("coze.index.importTemplate")}</Button></Upload>
      </div>
      {error && <Alert type="error" message={displayError(error)} />}
      {items.length === 0 ? <Empty description={t("coze.index.noTemplatesYet")} /> : <div className="template-grid">
        {items.map((item) => <article key={item.id} className="template-card">
          <header><span className="template-icon"><LayoutTemplate size={20} /></span>
            <small>{item.builtin ? t("coze.index.builtInTemplate") : t("coze.index.customTemplate")}</small></header>
          <h3>{shown(item, item.name)}</h3><p>{shown(item, item.description)}</p><Space wrap>
            <Button type="primary" loading={busy} onClick={() => void install(item.id)}>{t("coze.index.useTemplate")}</Button>
            <Button disabled={busy} onClick={() => void download(item.id)}>{t("coze.core.export")}</Button>
            {!item.builtin && <Popconfirm title={t("coze.index.removeFromTheTemplateGalleryContentYouAlreadyCreatedFrom")}
              styles={{ root: { maxWidth: 400 } }} onConfirm={() => perform(async () => {
                await api("delete_template", { id: item.id }); await refresh();
              })}><Button danger disabled={busy}>{t("coze.index.remove")}</Button></Popconfirm>}
          </Space></article>)}
      </div>}
    </Modal></>;
}
