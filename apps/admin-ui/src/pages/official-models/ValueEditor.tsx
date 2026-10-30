import inlineCopy from '@remoteai/i18n/copy/inline/admin/pages/official-models/ValueEditor';
import { interpolate as interpolateCopy } from '@remoteai/i18n';
import { useState } from "react";
import { Alert, Button, Input, InputNumber, Modal, Switch } from "antd";
import { JsonEditor } from "../../components/json-editor/JsonEditor";
import type { JsonValue } from "./catalog";

interface Props {
  value: JsonValue | undefined;
  onChange: (value: JsonValue) => void;
  label: string;
  disabled: boolean;
  zh: boolean;
  fallback?: "string" | "number";
}
const INLINE_TEXT_LIMIT = 160;

function valueSummary(value: JsonValue | undefined, zh: boolean) {
  if (value === undefined) return zh ? inlineCopy["text_2f5f1d6f"] : inlineCopy["Not_set_4895f731"];
  if (value === null) return "null";
  if (typeof value === "string") return zh ? interpolateCopy(inlineCopy["value1_91b2192e"], { value1: String(value.length) }) : interpolateCopy(inlineCopy["Text_value1_characters_12b89837"], { value1: String(value.length) });
  const count = Object.keys(value).length;
  if (Array.isArray(value)) return zh ? interpolateCopy(inlineCopy["value1_59f82110"], { value1: String(count) }) : interpolateCopy(inlineCopy["List_value1_items_8f504b73"], { value1: String(count) });
  return zh ? interpolateCopy(inlineCopy["value1_2d32e4de"], { value1: String(count) }) : interpolateCopy(inlineCopy["Object_value1_fields_80871190"], { value1: String(count) });
}

function ValueDialog({ value, onChange, label, disabled, zh }: Props) {
  const text = typeof value === "string";
  const [draft, setDraft] = useState(text ? value : JSON.stringify(value ?? null, null, 2));
  const [open, setOpen] = useState(false);
  let parsed: JsonValue = draft;
  let valid = true;
  if (!text) {
    try { parsed = JSON.parse(draft) as JsonValue; }
    catch { valid = false; }
  }
  return <>
    <Button block aria-label={`${label} ${zh ? inlineCopy["text_d42295ca"] : inlineCopy["View_or_edit_value_fd0628aa"]}`}
      onClick={() => { setDraft(text ? value : JSON.stringify(value ?? null, null, 2)); setOpen(true); }}>
      {valueSummary(value, zh)}</Button>
    <Modal title={label} open={open} width={800} destroyOnHidden
      okText={zh ? inlineCopy["text_63c73c47"] : inlineCopy["Apply_31e392d1"]} cancelText={zh ? inlineCopy["text_2cd0f3be"] : inlineCopy["Cancel_19766ed6"]}
      okButtonProps={{ disabled: disabled || !valid }} onCancel={() => setOpen(false)}
      onOk={() => { if (valid && !disabled) { onChange(parsed); setOpen(false); } }}>
      {text ? <Input.TextArea aria-label={label} value={draft} readOnly={disabled}
        autoSize={{ minRows: 12, maxRows: 22 }} onChange={(event) => setDraft(event.target.value)} />
        : <JsonEditor value={draft} onChange={setDraft} readOnly={disabled} zh={zh} label={label} />}
      {!valid && <Alert style={{ marginTop: 12 }} type="error" showIcon
        message={zh ? inlineCopy["JSON_f65dd268"] : inlineCopy["Fix_the_JSON_syntax_before_94d70816"]} />}
    </Modal>
  </>;
}

export function ValueEditor(props: Props) {
  const { value, onChange, label, disabled, zh, fallback } = props;
  const kind = value == null && fallback ? fallback : typeof value;
  if (kind === "string" && (value == null || (typeof value === "string"
    && value.length <= INLINE_TEXT_LIMIT && !value.includes("\n")))) {
    return <Input aria-label={label} value={(value ?? "") as string} disabled={disabled}
      placeholder={zh ? inlineCopy["text_2f5f1d6f"] : inlineCopy["Not_set_4895f731"]} onChange={(event) => onChange(event.target.value)} />;
  }
  if (kind === "number") return <InputNumber aria-label={label} value={value as number | null | undefined}
    disabled={disabled} style={{ width: "100%" }} onChange={(next) => onChange(next)} />;
  if (typeof value === "boolean") return <Switch aria-label={label} checked={value} disabled={disabled}
    checkedChildren={zh ? inlineCopy["text_b5141d3d"] : inlineCopy["Yes_85a39ab3"]} unCheckedChildren={zh ? inlineCopy["text_0c70665b"] : inlineCopy["No_1ea442a1"]} onChange={onChange} />;
  return <ValueDialog {...props} />;
}
