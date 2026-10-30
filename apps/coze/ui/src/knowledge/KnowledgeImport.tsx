import { useEffect, useState } from "react";
import { Button, Checkbox, Input, Select, Space, Tabs, Upload } from "antd";
import { FileUp } from "lucide-react";
import { api, errorText, fileBase64 } from "../api";
import { msg, useT } from "../i18n";
import type { Model } from "../types";
import type { useKnowledgeJob } from "./useKnowledgeJob";

interface Props {
  knowledgeId: string; chunk: { size: number; overlap: number };
  job: ReturnType<typeof useKnowledgeJob>; onError: (error: string) => void;
}

export function KnowledgeImport({ knowledgeId, chunk, job, onError }: Props) {
  const t = useT();
  const [models, setModels] = useState<Model[]>([]);
  const [model, setModel] = useState("");
  const [ocr, setOcr] = useState(false);
  const [url, setUrl] = useState("");
  const [reading, setReading] = useState(false);
  const busy = reading || job.busy;
  useEffect(() => {
    let active = true;
    void api<Model[]>("models").then((items) => { if (active) setModels(items); }).catch(() => {
      // Text and web imports remain available if the local model list is temporarily unavailable.
    });
    return () => { active = false; };
  }, []);
  // Errors are passed on as Chinese sources; the panel translates them when it renders them.
  const upload = async (file: File) => {
    if (busy) return;
    if (file.size > 32 * 1024 * 1024) { onError(msg("coze.index.chooseAFileOf32MbOrLess")); return; }
    const image = /\.(png|jpe?g|webp)$/i.test(file.name);
    const visual = image || (ocr && /\.pdf$/i.test(file.name));
    if (visual && !model) { onError(msg("coze.index.chooseAModelThatSupportsImageRecognitionFirst")); return; }
    if (image && file.size > 16 * 1024 * 1024) { onError(msg("coze.index.chooseAnImageOf16MbOrLess")); return; }
    setReading(true);
    try {
      await job.start(visual ? "import_media_document_start" : "import_document_start", {
        knowledgeId, name: file.name, contentBase64: await fileBase64(file), chunk, ...(visual ? { model } : {}),
      });
    } catch (error) { onError(errorText(error)); } finally { setReading(false); }
  };
  return <Tabs items={[
    { key: "file", label: t("coze.index.filesAndImages"), children: <Space direction="vertical" style={{ width: "100%" }}>
      <Select aria-label={t("coze.index.imageRecognitionModel")} placeholder={t("coze.index.toRecognizeImagesChooseAModelThatSupportsThem")} showSearch
        style={{ width: "100%" }} value={model || undefined} onChange={setModel} disabled={busy}
        options={models.map((item) => ({ value: item.id, label: item.name }))} />
      <Checkbox checked={ocr} onChange={(event) => setOcr(event.target.checked)} disabled={busy}>
        {t("coze.index.recognizeTextInScannedPdfs")}</Checkbox>
      <Upload.Dragger accept=".txt,.md,.markdown,.pdf,.docx,.csv,.json,.tsv,.xlsx,.png,.jpg,.jpeg,.webp"
        showUploadList={false} disabled={busy} beforeUpload={(file) => { void upload(file); return false; }}>
        <FileUp size={30} /><p>{busy ? t("coze.index.processingContentPleaseWait") : t("coze.index.dropAFileHereOrClickToChooseOne")}</p>
        <small>{t("coze.index.documentsUpTo32MbImagesUpTo16Mb")}</small>
      </Upload.Dragger>
      <small>{t("coze.index.theSelectedModelRecognizesImagesAndScansThenYouCan")}</small>
    </Space> },
    { key: "web", label: t("coze.index.webPage"), children: <Space direction="vertical" style={{ width: "100%" }}>
      <Input aria-label={t("coze.index.webPageUrl")} placeholder="https://example.com/article" value={url}
        onChange={(event) => setUrl(event.target.value)} disabled={busy} />
      <Button type="primary" loading={busy} disabled={!url.trim()} onClick={() => void job.start(
        "import_web_document_start", { knowledgeId, url: url.trim(), chunk })}>{t("coze.index.importWebPage")}</Button>
      <small>{t("coze.index.importsTextFromPublicWebPagesForContentThatRequires")}</small>
    </Space> },
  ]} />;
}
