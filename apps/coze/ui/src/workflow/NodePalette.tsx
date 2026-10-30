import { displayText } from '../i18n/index';
import { useState } from "react";
import { Button, Empty, Input, Popover } from "antd";
import { Plus, Search } from "lucide-react";
import { msg, useT } from "../i18n";
import { nodeLabels } from "./nodes";

const groups = [
  { label: msg("coze.index.aiAndKnowledge"), types: ["llm", "knowledge", "intent", "knowledge_write", "knowledge_delete"] },
  { label: msg("coze.index.logicAndInteraction"), types: ["condition", "subworkflow", "loop", "repeat", "break", "continue",
    "input", "output", "end"] },
  { label: msg("coze.index.textAndVariables"), types: ["template", "code", "variable", "aggregate", "aggregate_groups",
    "json_parse", "json_stringify"] },
  { label: msg("coze.index.toolsAndData"), types: ["plugin", "http", "conversation", "sql", "nl2sql", "table_query",
    "table_write", "table_update", "table_delete"] },
];

export function NodePalette({ onAdd }: { onAdd: (type: string) => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  // Search the label shown in the current language and the type id.
  const filtered = groups.map((group) => ({ ...group, types: group.types.filter((type) =>
    `${displayText(nodeLabels[type])} ${type}`.toLowerCase().includes(search.toLowerCase())) }));
  return <Popover trigger="click" placement="bottomLeft" open={open}
    onOpenChange={(value) => { setOpen(value); if (!value) setSearch(""); }}
    content={<div className="node-palette"><Input aria-label={t("coze.index.searchNodes")} placeholder={t("coze.index.searchNodes")}
      prefix={<Search size={14} />} value={search} onChange={(event) => setSearch(event.target.value)} allowClear />
      <div className="node-palette-list">{filtered.map((group) => group.types.length > 0 && <section key={group.label}>
        <h4>{t(group.label)}</h4><div>{group.types.map((type) => <Button key={type} type="text"
          onClick={() => { onAdd(type); setOpen(false); setSearch(""); }}>{displayText(nodeLabels[type])}</Button>)}</div>
      </section>)}{filtered.every((group) => !group.types.length) && <Empty description={t("coze.index.noNodesFound")} />}</div>
    </div>}><Button icon={<Plus size={15} />}>{t("coze.index.addNode")}</Button></Popover>;
}
