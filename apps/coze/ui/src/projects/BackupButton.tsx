import { displayError } from '../i18n/index';
import { useState } from "react";
import { Alert, App, Button, Modal, Upload } from "antd";
import { Download, FolderArchive, Upload as UploadIcon } from "lucide-react";
import { errorText } from "../api";
import { msg, useT } from "../i18n";

export function BackupButton({ onRestored }: { onRestored: () => void }) {
  const { modal } = App.useApp();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const perform = async (file?: File) => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/backup", { method: file ? "POST" : "GET", body: file,
        headers: { Authorization: `Bearer ${sessionStorage.getItem("coze-session") ?? ""}` } });
      if (!response.ok) {
        const result = await response.json() as { error?: string };
        throw new Error(result.error ?? msg("coze.index.couldnTCompleteTheBackupOperationTryAgainLater"));
      }
      if (file) { onRestored(); setOpen(false); return; }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a"); anchor.href = url;
      anchor.download = `coze-${new Date().toISOString().slice(0, 10)}.coze`; anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) { setError(errorText(error)); } finally { setBusy(false); }
  };
  const restore = (file: File) => {
    // App.useApp().modal follows the ConfigProvider locale and theme; static Modal.confirm does not.
    modal.confirm({ title: t("coze.index.replaceYourCurrentContentWithTheBackup"), width: 400,
      content: t("coze.index.yourCurrentContentWillBeReplacedAndAccessLinksWill"),
      okText: t("coze.index.restoreBackup"), cancelText: t("coze.core.cancel"), okButtonProps: { danger: true }, onOk: () => perform(file) });
    return false;
  };
  return <><button className="studio-nav-button" aria-label={t("coze.index.backupAndRestore")} onClick={() => setOpen(true)}>
    <FolderArchive size={18} /><span>{t("coze.index.backupAndRestore")}</span></button>
    <Modal className="studio-dialog" title={t("coze.index.backupAndRestore")} open={open} width={400} centered
      footer={null} onCancel={() => setOpen(false)}>
      <p>{t("coze.index.saveAFullBackupSoYouCanRestoreYourWork")}</p>
      <section className="backup-option"><h3><Download size={18} />{t("coze.index.downloadBackup")}</h3>
        <p>{t("coze.index.includesAppsDocumentsConversationsPublishedVersionsAndRunHistory")}</p>
        <Button block type="primary" loading={busy} onClick={() => void perform()}>{t("coze.index.downloadFullBackup")}</Button>
      </section>
      <section className="backup-option"><h3><UploadIcon size={18} />{t("coze.index.restoreBackup")}</h3>
        <p>{t("coze.index.chooseABackupFileRestoringItReplacesYourCurrentContent")}</p>
        <Upload className="backup-upload" accept=".coze" beforeUpload={restore}
          showUploadList={false} disabled={busy}>
          <Button block disabled={busy}>{t("coze.index.chooseBackupFile")}</Button></Upload>
      </section>
      {error && <Alert style={{ marginTop: 12 }} type="error" message={displayError(error)} />}
    </Modal></>;
}
