import inlineCopy from '@remoteai/i18n/copy/inline/admin/pages/official-models/ModelsTable';
import { useState } from "react";
import { Button, Popconfirm, Select, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { ModelFields } from "./ModelFields";
import { ValueEditor } from "./ValueEditor";
import { addModel, removeModel, updateModel, type JsonObject, type ModelCatalog } from "./catalog";

interface Props {
  catalog: ModelCatalog;
  onChange: (catalog: ModelCatalog) => void;
  disabled: boolean;
  canManage: boolean;
  zh: boolean;
}
interface ModelRow { index: number; model: JsonObject }

function visibilityOptions(current: string | undefined, zh: boolean) {
  const labels: Record<string, string> = { list: zh ? inlineCopy["text_4e1449e7"] : inlineCopy["Visible_8411f5ab"], hide: zh ? inlineCopy["text_145219e7"] : inlineCopy["Hidden_7e6fefff"] };
  return [...new Set(["list", "hide", ...(current ? [current] : [])])]
    .map((value) => ({ value, label: labels[value] ?? value }));
}

export function ModelsTable({ catalog, onChange, disabled, canManage, zh }: Props) {
  const [expanded, setExpanded] = useState<readonly React.Key[]>([]);
  const update = (index: number, patch: JsonObject) => onChange(updateModel(catalog, index, patch));
  const field = (row: ModelRow, key: string, fallback: "string" | "number" = "string") => <ValueEditor
    value={row.model[key]} fallback={fallback} label={`${row.index + 1} ${key}`} disabled={disabled}
    zh={zh} onChange={(value) => update(row.index, { [key]: value })} />;
  const columns: ColumnsType<ModelRow> = [
    { title: zh ? inlineCopy["text_93e08803"] : inlineCopy["Model_ID_089ef2b6"], key: "id", width: 200,
      render: (_, row) => field(row, "slug" in row.model || !("id" in row.model) ? "slug" : "id") },
    { title: zh ? inlineCopy["text_a9858587"] : inlineCopy["Display_name_2b7f6a84"], key: "name", width: 180,
      render: (_, row) => field(row, "display_name") },
    { title: zh ? inlineCopy["text_dc2ba467"] : inlineCopy["Description_526e0087"], key: "description", width: 260,
      render: (_, row) => field(row, "description") },
    { title: zh ? inlineCopy["text_bb074b86"] : inlineCopy["Context_window_7696d085"], key: "context", width: 155,
      render: (_, row) => field(row, "context_window", "number") },
    { title: zh ? inlineCopy["text_7e228d46"] : inlineCopy["Visibility_7448611d"], key: "visibility", width: 120,
      render: (_, { index, model }) => typeof model.visibility === "string" || model.visibility === undefined
        ? <Select aria-label={`${index + 1} visibility`} style={{ width: "100%" }} disabled={disabled}
          value={model.visibility} placeholder={zh ? inlineCopy["text_2f5f1d6f"] : inlineCopy["Not_set_4895f731"]}
          options={visibilityOptions(model.visibility, zh)}
          onChange={(value) => update(index, { visibility: value })} />
        : field({ index, model }, "visibility") },
  ];
  if (canManage) columns.push({ title: zh ? inlineCopy["text_ed31fbb4"] : inlineCopy["Actions_ff8059dc"], key: "actions", width: 90,
    render: (_, { index }) => <Popconfirm title={zh ? inlineCopy["text_c5e8cc60"] : inlineCopy["Remove_this_model_from_the_2fc1a9f9"]}
      styles={{ body: { maxWidth: 400, whiteSpace: "normal" } }} disabled={disabled}
      okText={zh ? inlineCopy["text_6135d415"] : inlineCopy["Remove_c3812fc4"]} cancelText={zh ? inlineCopy["text_2cd0f3be"] : inlineCopy["Cancel_19766ed6"]}
      onConfirm={() => { setExpanded([]); onChange(removeModel(catalog, index)); }}>
      <Button danger type="text" disabled={disabled}>{zh ? inlineCopy["text_6135d415"] : inlineCopy["Remove_c3812fc4"]}</Button>
    </Popconfirm> });
  return <>
    <Table<ModelRow> rowKey="index" size="small" columns={columns} pagination={false} scroll={{ x: 1100 }}
      dataSource={catalog.models.map((model, index) => ({ model, index }))}
      expandable={{ expandedRowKeys: expanded, onExpandedRowsChange: setExpanded,
        columnTitle: zh ? inlineCopy["text_979a3329"] : inlineCopy["Details_45989de4"], columnWidth: 64,
        expandedRowRender: ({ index, model }) => <ModelFields model={model} disabled={disabled} zh={zh}
          onChange={(patch) => update(index, patch)} /> }} />
    {canManage && <Button style={{ marginTop: 12 }} disabled={disabled} onClick={() => onChange(addModel(catalog))}>
      {zh ? inlineCopy["text_168e845a"] : inlineCopy["Add_model_b2609f7d"]}</Button>}
  </>;
}
