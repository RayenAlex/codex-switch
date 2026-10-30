import inlineCopy from '@remoteai/i18n/copy/inline/admin/pages/official-models/ModelFields';
import { useState } from "react";
import { Input, Table } from "antd";
import { ValueEditor } from "./ValueEditor";
import type { JsonObject } from "./catalog";

interface Props {
  model: JsonObject;
  onChange: (patch: JsonObject) => void;
  disabled: boolean;
  zh: boolean;
}

export function ModelFields({ model, onChange, disabled, zh }: Props) {
  const [search, setSearch] = useState("");
  const fields = Object.entries(model).filter(([field]) => field.toLowerCase().includes(search.toLowerCase()));
  return <div style={{ padding: "8px 0" }}>
    <Input.Search value={search} onChange={(event) => setSearch(event.target.value)} allowClear
      aria-label={zh ? inlineCopy["text_7fecaeb8"] : inlineCopy["Search_fields_ae021540"]} placeholder={zh ? inlineCopy["text_7fecaeb8"] : inlineCopy["Search_fields_ae021540"]}
      style={{ maxWidth: 320, marginBottom: 12 }} />
    <Table size="small" rowKey="field" pagination={false} scroll={{ y: 480, x: 650 }}
      dataSource={fields.map(([field, value]) => ({ field, value }))} columns={[
        { title: zh ? inlineCopy["text_49ecd0e3"] : inlineCopy["Field_f45fc1df"], dataIndex: "field", width: 300,
          render: (field: string) => <code style={{ overflowWrap: "anywhere" }}>{field}</code> },
        { title: zh ? inlineCopy["text_cda1d55c"] : inlineCopy["Value_8e37953d"], key: "value", render: (_, { field, value }) => <ValueEditor
          value={value} label={field} disabled={disabled} zh={zh} onChange={(next) => onChange({ [field]: next })} /> },
      ]} />
  </div>;
}
