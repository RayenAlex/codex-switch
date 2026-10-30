import { Button, Image, Space, Tag } from "antd";
import { useT } from "../i18n";

export interface SourceInfo {
  documentId: string; kind: "web" | "image" | "scanned_pdf"; url?: string;
  mimeType: string; updatedAt: string; contentBase64?: string;
}

interface Props { source?: SourceInfo; busy: boolean; onRefresh: () => void; onPreview: () => void }

export function DocumentSource({ source, busy, onRefresh, onPreview }: Props) {
  const t = useT();
  if (!source) return null;
  if (source.kind === "web") return <Space wrap>
    <Tag>{t("coze.index.webPage")}</Tag><a href={source.url} target="_blank" rel="noreferrer">{t("coze.index.viewSource")}</a>
    <Button size="small" type="link" loading={busy} onClick={onRefresh}>{t("coze.index.updatePageContent")}</Button>
  </Space>;
  return <Space><Tag>{source.kind === "image" ? t("coze.index.image") : t("coze.index.scannedPdf")}</Tag>
    {source.kind === "image" && <Button size="small" type="link" onClick={onPreview}>{t("coze.index.viewOriginalImage")}</Button>}</Space>;
}

export function OriginalImage({ source, onClose }: { source?: SourceInfo; onClose: () => void }) {
  if (!source?.contentBase64) return null;
  return <Image style={{ display: "none" }} src={`data:${source.mimeType};base64,${source.contentBase64}`}
    preview={{ visible: true, onVisibleChange: (visible) => { if (!visible) onClose(); } }} />;
}
