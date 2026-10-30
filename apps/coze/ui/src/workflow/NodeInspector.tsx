import { displayText } from '../i18n/index';
import { useEffect, useState, type ReactNode } from "react";
import { Button, Checkbox, Input, InputNumber, Select } from "antd";
import { X } from "lucide-react";
import type { Graph, Json, Model, Node, Resource } from "../types";
import { useT, verbatim } from "../i18n";
import { nodeLabels } from "./nodes";
import { useInvalidField } from "../draftValidation";
import { ConnectionEditor } from "./ConnectionEditor";
import { isTerminal, removeSelection } from "./graphEditing";

interface Props {
  node: Node; graph: Graph; resources: Resource[]; models: Model[];
  onChange: (graph: Graph) => void; onClose: () => void;
}

/** Renders a translated sentence with a `{code}` placeholder, putting `code` in its place. */
function withCode(message: string, code: ReactNode) {
  const [before, ...after] = message.split("{code}");
  return <>{before}{code}{after.join("{code}")}</>;
}

export function NodeInspector({ node, graph, resources, models, onChange, onClose }: Props) {
  const t = useT();
  const update = (key: string, value: Json) => onChange({ ...graph,
    nodes: graph.nodes.map((item) => item.id === node.id ? { ...item, [key]: value } : item) });
  const text = (key: string, label: string, rows = 3) => <label key={key}>{label}
    <Input.TextArea value={String(node[key] ?? "")} rows={rows} onChange={(event) => update(key, event.target.value)} />
  </label>;
  const json = (key: string, label: string) => <JsonInput key={`${node.id}-${key}`} label={label}
    value={node[key]} onChange={(value) => update(key, value)} />;
  const workflows = resources.filter((item) => item.kind === "workflow").map((item) => ({ value: item.id, label: item.name }));
  const dataProcessingHint = node.language === "python" || node.entrypoint
    ? t("coze.index.inMainArgsReadTheInputFromArgsParamsAnd")
    : t("coze.index.readTheInputFromInputAndReturnTheResultWith");
  const label = nodeLabels[node.type] as string | undefined;
  return <aside className="node-inspector"><header><h3>{label && displayText(label)}</h3>
    <Button type="text" aria-label={t("coze.index.closeNodeSettings")} icon={<X size={16} />} onClick={onClose} /></header>
    <label>{t("coze.core.name")}<Input value={node.name} onChange={(event) => update("name", event.target.value)} /></label>
    <small>{withCode(t("coze.index.referenceTheInput"), <code>{"{{input.text}}"}</code>)}<br />
      {withCode(t("coze.index.thisNodeSResult"), <code>{`{{${node.id}.output}}`}</code>)}</small>
    {node.type === "start" && <><h4>{t("coze.index.inputParameters")}</h4>{(graph.inputs ?? []).map((field, index) => <div key={index}>
      <Input aria-label={t("coze.index.parameterName")} placeholder={t("coze.index.parameterName")} value={field.name} onChange={(event) => onChange({ ...graph,
        inputs: graph.inputs?.map((item, cursor) => cursor === index ? { ...item, name: event.target.value } : item) })} />
      <Input aria-label={t("coze.index.parameterDescription")} placeholder={t("coze.index.description")} value={field.description} onChange={(event) => onChange({ ...graph,
        inputs: graph.inputs?.map((item, cursor) => cursor === index ? { ...item, description: event.target.value } : item) })} />
      <Select className="full" value={field.kind} options={["string", "number", "integer", "boolean", "object", "array"]
        .map((value) => ({ value }))} onChange={(kind) => onChange({ ...graph,
          inputs: graph.inputs?.map((item, cursor) => cursor === index ? { ...item, kind } : item) })} />
      <Checkbox checked={field.required} onChange={(event) => onChange({ ...graph,
        inputs: graph.inputs?.map((item, cursor) => cursor === index ? { ...item, required: event.target.checked } : item) })}>
        {t("coze.index.required")}</Checkbox><Button type="text" danger onClick={() => onChange({ ...graph,
          inputs: graph.inputs?.filter((_, cursor) => cursor !== index) })}>{t("coze.index.remove")}</Button>
    </div>)}<Button onClick={() => onChange({ ...graph, inputs: [...(graph.inputs ?? []), {
      name: `input${(graph.inputs?.length ?? 0) + 1}`, description: "", kind: "string", required: false,
    }] })}>{t("coze.index.addParameter")}</Button></>}
    {node.type === "llm" && <><label>{t("coze.agents.model")}<Select className="full" showSearch value={String(node.model || "") || undefined}
      options={models.map((model) => ({ value: model.id, label: model.name }))} onChange={(value) => update("model", value)} />
    </label>{text("system", t("coze.agents.systemPrompt"))}{text("prompt", t("coze.index.userPrompt"), 6)}
      <label>{t("coze.index.randomness")}<InputNumber min={0} max={2} step={0.1} value={Number(node.temperature ?? 0.7)}
        onChange={(value) => update("temperature", value ?? 0.7)} /></label></>}
    {node.type === "intent" && <><label>{t("coze.agents.model")}<Select className="full" value={String(node.model || "") || undefined}
      options={models.map((model) => ({ value: model.id, label: model.name }))} onChange={(value) => update("model", value)} />
      </label>{text("query", t("coze.index.textToClassify"))}{json("intents", t("coze.index.candidateIntents"))}
      {/* The runtime returns this literal intent when nothing matches (advanced_nodes.rs): never translate it. */}
      <small>{t("coze.index.theIntentFieldOfTheResultHoldsTheMatchedIntent", { fallback: verbatim("其他") })}</small></>}
    {node.type === "template" && text("template", t("coze.index.textTemplate"), 8)}
    {node.type === "input" && <>{text("prompt", t("coze.index.question"))}{json("fields", t("coze.index.fieldsToFillIn"))}
      {json("choices", t("coze.index.answerOptionsLeaveEmptyForAFreeFormAnswer"))}</>}
    {node.type === "output" && json("value", t("coze.index.outputMessage"))}
    {node.type === "variable" && <>{text("variable_name", t("coze.index.variableName"), 1)}{json("value", t("coze.index.variableValue"))}
      <small>{withCode(t("coze.index.laterNodesCanReadItWith"), <code>{t("coze.index.variablesVariableName")}</code>)}</small></>}
    {node.type === "aggregate" && <>{json("values", t("coze.index.candidateValuesInPriorityOrder"))}
      <small>{t("coze.index.usesTheFirstValueThatHasBeenProducedAndIsn")}</small></>}
    {node.type === "aggregate_groups" && json("groups", t("coze.index.groupNamesAndCandidateValues"))}
    {node.type === "conversation" && <><label>{t("coze.index.operation")}<Select className="full" value={String(node.operation)}
      onChange={(value) => update("operation", value)} options={[
        { value: "create", label: t("coze.index.createConversation") }, { value: "list", label: t("coze.index.listConversations") },
        { value: "rename", label: t("coze.index.renameConversation") }, { value: "delete", label: t("coze.index.deleteConversation") },
        { value: "history", label: t("coze.index.getMessages") }, { value: "append", label: t("coze.index.addMessage") },
        { value: "edit_message", label: t("coze.index.editMessage") }, { value: "delete_message", label: t("coze.index.deleteMessage") },
        { value: "clear", label: t("coze.index.clearMessages") },
      ]} /></label>{json("input", t("coze.index.operationInput"))}
      <small>{t("coze.index.toCreateSetTitleToQuerySetConversationidToAdd")}</small></>}
    {node.type.startsWith("table_") && <><label>{t("coze.index.table")}<Select className="full" value={String(node.table_id || "") || undefined}
      options={resources.filter((item) => item.kind === "table").map((item) => ({ value: item.id, label: item.name }))}
      onChange={(value) => update("table_id", value)} /></label>
      {node.type === "table_query" && json("filter", t("coze.index.fieldsToMatchJson"))}
      {node.type === "table_write" && json("value", t("coze.index.recordJson"))}
      {node.type === "table_update" && <>{text("row_id", t("coze.index.recordId"), 2)}{json("value", t("coze.index.fullUpdatedRecord"))}</>}
      {node.type === "table_delete" && text("row_id", t("coze.index.recordId"), 2)}</>}
    {(node.type === "sql" || node.type === "nl2sql") && <><label>{t("coze.index.table")}<Select mode="multiple"
      className="full" value={node.table_ids as string[]} onChange={(value) => update("table_ids", value)}
      options={resources.filter((item) => item.kind === "table").map((item) => ({ value: item.id, label: item.name }))} />
      </label>{node.type === "sql" ? text("sql", t("coze.index.query"), 8) : <>
        <label>{t("coze.agents.model")}<Select className="full" value={String(node.model || "") || undefined}
          options={models.map((model) => ({ value: model.id, label: model.name }))}
          onChange={(value) => update("model", value)} /></label>{text("question", t("coze.index.queryDescription"), 4)}</>}
      <small>{t("coze.index.tablesAreNamedT1T2AndSoOnInThe")}</small></>}
    {node.type === "plugin" && <><label>{t("coze.index.tool")}<Select className="full" value={String(node.plugin_id || "") || undefined}
      options={resources.filter((item) => item.kind === "plugin").map((item) => ({ value: item.id, label: item.name }))}
      onChange={(value) => update("plugin_id", value)} /></label>{json("input", t("coze.index.callParametersJson"))}</>}
    {node.type === "code" && <><label>{t("coze.index.language")}<Select className="full" value={String(node.language || "javascript")}
      options={[{ value: "javascript", label: "JavaScript" }, { value: "typescript", label: "TypeScript" },
        { value: "python", label: "Python" }]} onChange={(value) => update("language", value)} /></label>
      {node.language !== "python" && <Checkbox checked={Boolean(node.entrypoint)}
        onChange={(event) => update("entrypoint", event.target.checked)}>{t("coze.index.useAMainFunction")}</Checkbox>}
      {json("input", t("coze.index.inputJson"))}{text("code", t("coze.index.code"), 12)}
      <small>{dataProcessingHint}</small></>}
    {node.type === "end" && json("value", t("coze.index.outputJson"))}
    {node.type === "knowledge" && <><label>{t("coze.index.knowledgeBase")}<Select className="full" mode="multiple"
      value={node.knowledge_ids as string[]} options={resources.filter((item) => item.kind === "knowledge")
        .map((item) => ({ value: item.id, label: item.name }))} onChange={(value) => update("knowledge_ids", value)} /></label>
      {text("query", t("coze.index.searchQuery"))}<label>{t("coze.index.numberOfResults")}<InputNumber min={1} max={20} value={Number(node.limit)}
        onChange={(value) => update("limit", value ?? 6)} /></label></>}
    {(node.type === "knowledge_write" || node.type === "knowledge_delete") && <><label>{t("coze.index.knowledgeBase")}<Select
      className="full" value={String(node.knowledge_id || "") || undefined}
      options={resources.filter((item) => item.kind === "knowledge").map((item) => ({ value: item.id, label: item.name }))}
      onChange={(value) => update("knowledge_id", value)} /></label>
      {node.type === "knowledge_write" ? <>{text("document_name", t("coze.index.documentName"), 1)}{text("text", t("coze.index.documentContent"), 6)}</>
        : json("document_ids", t("coze.index.idsOfDocumentsToDelete"))}</>}
    {node.type === "condition" && <>{json("left", t("coze.index.valueToCompareJson"))}
      <label>{t("coze.index.condition.16bb1d")}<Select className="full" value={String(node.operator)} onChange={(value) => update("operator", value)}
        options={[{ value: "equal", label: t("coze.index.equals") }, { value: "not_equal", label: t("coze.index.doesnTEqual") },
          { value: "contains", label: t("coze.index.contains") }, { value: "greater", label: t("coze.index.greaterThan") },
          { value: "less", label: t("coze.index.lessThan") }, { value: "empty", label: t("coze.index.isEmpty") }]} /></label>{json("right", t("coze.index.targetValueJson"))}</>}
    {node.type === "http" && <>{text("url", t("coze.index.httpsUrl"), 2)}<label>{t("coze.index.requestMethod")}<Select className="full"
      value={String(node.method)} options={["GET", "POST", "PUT", "DELETE"].map((value) => ({ value }))}
      onChange={(value) => update("method", value)} /></label>{json("body", t("coze.index.requestBodyJson"))}</>}
    {node.type === "json_parse" && text("text", t("coze.index.textToParse"))}
    {node.type === "json_stringify" && json("value", t("coze.index.valueToConvertJson"))}
    {["subworkflow", "loop", "repeat"].includes(node.type) && <><label>{t("coze.index.workflow")}<Select className="full"
      value={String(node.workflow_id || "") || undefined} options={workflows}
      onChange={(value) => update("workflow_id", value)} /></label>
      {node.type === "loop" && json("items", t("coze.index.listToProcessJson"))}
      {node.type === "repeat" && json("count", t("coze.index.numberOfIterations"))}
      {node.type === "subworkflow" && json("input", t("coze.index.inputJson"))}
      {node.type !== "subworkflow" && <small>{t("coze.index.insideTheLoopYouCanReadInputItemInputIndex")}</small>}</>}
    {["break", "continue"].includes(node.type) && <small>{t("coze.index.forLoopBodyWorkflowsTakesEffectAsSoonAsThe")}</small>}
    {!isTerminal(node.type) && <ConnectionEditor node={node} graph={graph} onChange={onChange} />}
    {node.type !== "start" && <Button danger disabled={node.type === "end"
      && graph.nodes.filter((item) => item.type === "end").length === 1}
      onClick={() => { onChange(removeSelection(graph, [node.id], [])); onClose(); }}>{t("coze.index.deleteNode")}</Button>}
  </aside>;
}

function JsonInput({ value, onChange, label }: { value: Json; onChange: (value: Json) => void; label: string }) {
  const t = useT();
  const [text, setText] = useState(JSON.stringify(value, null, 2));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setText((current) => {
      try { if (JSON.stringify(JSON.parse(current)) === JSON.stringify(value)) return current; }
      catch { /* An external undo replaces unfinished JSON as well as valid values. */ }
      return JSON.stringify(value, null, 2);
    });
    setInvalid(false);
  }, [value]);
  useInvalidField(invalid);
  return <label>{label}<Input.TextArea rows={3} value={text} status={invalid ? "error" : undefined}
    onChange={(event) => {
      const next = event.target.value; setText(next);
      try { onChange(JSON.parse(next) as Json); setInvalid(false); } catch { setInvalid(true); }
    }} />{invalid && <small className="error-text">{t("coze.index.enterValidJson")}</small>}</label>;
}
