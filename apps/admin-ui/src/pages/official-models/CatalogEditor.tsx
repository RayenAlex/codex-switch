import inlineCopy from '@remoteai/i18n/copy/inline/admin/pages/official-models/CatalogEditor';
import { useState } from "react";
import { Alert, Segmented, Space, Typography } from "antd";
import { JsonEditor } from "../../components/json-editor/JsonEditor";
import { ModelsTable } from "./ModelsTable";
import { catalogErrorMessage, type CatalogDraft } from "./catalog";

interface Props {
  draft: string;
  onChange: (value: string) => void;
  parsed: CatalogDraft;
  disabled: boolean;
  canManage: boolean;
  zh: boolean;
}

export function CatalogEditor({ draft, onChange, parsed, disabled, canManage, zh }: Props) {
  const [mode, setMode] = useState<"table" | "json">("table");
  const activeMode = parsed.catalog ? mode : "json";
  return <Space direction="vertical" size="middle" style={{ display: "flex", minWidth: 0 }}>
    <Space wrap>
      <Typography.Text strong>{zh ? inlineCopy["text_ea4bf042"] : inlineCopy["Model_list_3da65546"]}</Typography.Text>
      <Segmented value={activeMode} onChange={setMode} options={[
        { label: zh ? inlineCopy["text_ab78f7fd"] : inlineCopy["Table_16d1c905"], value: "table", disabled: !parsed.catalog },
        { label: zh ? inlineCopy["JSON_301ca499"] : inlineCopy["JSON_db1a21a0"], value: "json" },
      ]} />
    </Space>
    {activeMode === "table" && parsed.catalog ? <>
      <Typography.Text type="secondary">{zh ? inlineCopy["text_d662434e"]
        : inlineCopy["Expand_a_model_to_edit_80b9afeb"]}</Typography.Text>
      <ModelsTable catalog={parsed.catalog} onChange={(catalog) => onChange(JSON.stringify(catalog, null, 2))}
        disabled={disabled} canManage={canManage} zh={zh} />
    </> : <JsonEditor value={draft} onChange={onChange} readOnly={disabled} zh={zh}
      label={zh ? inlineCopy["text_0cd8882b"] : inlineCopy["Model_list_content_75fa0e07"]} />}
    {parsed.error && <Alert type="error" showIcon message={catalogErrorMessage(parsed.error, zh)} />}
  </Space>;
}
