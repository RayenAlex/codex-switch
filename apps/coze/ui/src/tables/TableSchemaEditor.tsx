import { displayError } from '../i18n/index';
import { useEffect, useState } from "react";
import { Alert, Button, Checkbox, Input, Select, Space } from "antd";
import { api, errorText } from "../api";
import { msg, useT } from "../i18n";

interface Column { name: string; kind: string; required: boolean }
interface Schema { columns: Column[]; revision: number }
// Labels are Chinese sources, translated when the options are rendered; values are protocol ids.
const kinds = [
  { value: "string", label: msg("coze.index.text") }, { value: "integer", label: msg("coze.index.integer") }, { value: "number", label: msg("coze.index.number") },
  { value: "boolean", label: msg("coze.index.yesNo") }, { value: "time", label: msg("coze.index.dateAndTime") }, { value: "json", label: msg("coze.index.objectOrArray") },
];

export function TableSchemaEditor({ tableId }: { tableId: string }) {
  const t = useT();
  const [schema, setSchema] = useState<Schema>({ columns: [], revision: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let active = true;
    void api<Schema>("table_schema", { id: tableId }).then((value) => { if (active) setSchema(value); })
      .catch((error: unknown) => { if (active) setError(errorText(error)); });
    return () => { active = false; };
  }, [tableId]);
  const update = (columns: Column[]) => { setSchema({ ...schema, columns }); setSaved(false); };
  const save = async () => {
    setBusy(true); setError("");
    try { setSchema(await api<Schema>("save_table_schema", { tableId, ...schema })); setSaved(true); }
    catch (error) { setError(errorText(error)); } finally { setBusy(false); }
  };
  const kindOptions = kinds.map((kind) => ({ value: kind.value, label: t(kind.label) }));
  return <Space direction="vertical" style={{ width: "100%" }}>
    <p>{t("coze.index.onceFieldsAreSetNewAndExistingRecordsMustMatch")}</p>
    {error && <Alert type="error" message={displayError(error)} />}
    {saved && <Alert type="success" message={t("coze.index.fieldSettingsSaved")} />}
    {schema.columns.map((column, index) => <Space key={index} wrap>
      <Input aria-label={t("coze.index.fieldName", { index: index + 1 })} placeholder={t("coze.index.fieldName.89da4a")} value={column.name}
        maxLength={64} onChange={(event) => update(schema.columns.map((item, position) => position === index
          ? { ...item, name: event.target.value } : item))} />
      <Select aria-label={t("coze.index.fieldType", { index: index + 1 })} value={column.kind} options={kindOptions}
        style={{ width: 160 }} onChange={(kind: string) => update(schema.columns.map((item, position) => position === index
          ? { ...item, kind } : item))} />
      <Checkbox checked={column.required} onChange={(event) => update(schema.columns.map((item, position) =>
        position === index ? { ...item, required: event.target.checked } : item))}>{t("coze.index.required")}</Checkbox>
      <Button danger type="text" onClick={() => update(schema.columns.filter((_, position) => position !== index))}>
        {t("coze.index.remove")}</Button>
    </Space>)}
    <Space><Button disabled={schema.columns.length >= 100 || busy} onClick={() => update([...schema.columns,
      { name: "", kind: "string", required: false }])}>{t("coze.index.addField")}</Button>
      <Button type="primary" loading={busy} onClick={() => void save()}>{t("coze.index.saveFieldSettings")}</Button></Space>
    <small>{t("coze.index.enterDatesAndTimesInFullWithATimeZone")}</small>
  </Space>;
}
