import type { MessageKey } from '@remoteai/i18n';
import { msg, t as currentTranslate, type Translate } from "../i18n";
import type { Json, Node } from "../types";

/** Node type names as semantic keys; render them with `t(nodeLabels[type])`. */
export const nodeLabels: Readonly<Record<string, MessageKey>> = {
  start: msg("coze.core.start"), end: msg("coze.core.end"), llm: msg("coze.index.llm"), knowledge: msg("coze.index.knowledgeRetrieval"), template: msg("coze.core.textProcessing"),
  condition: msg("coze.index.condition"), http: msg("coze.index.httpRequest"), json_parse: msg("coze.index.parseJson"), json_stringify: msg("coze.index.buildJson"),
  subworkflow: msg("coze.index.subworkflow"), loop: msg("coze.index.batchRun"),
  code: msg("coze.index.code"),
  input: msg("coze.index.waitForUserInput"), output: msg("coze.index.outputMessage"), variable: msg("coze.index.setVariable"), aggregate: msg("coze.index.mergeBranchVariables"),
  aggregate_groups: msg("coze.index.mergeVariablesByGroup"), conversation: msg("coze.index.conversationsAndMessages"),
  sql: msg("coze.index.sqlQuery"), nl2sql: msg("coze.index.naturalLanguageToSql"),
  intent: msg("coze.index.intentRecognition"), knowledge_write: msg("coze.index.writeToKnowledgeBase"), knowledge_delete: msg("coze.index.deleteKnowledgeDocument"),
  table_update: msg("coze.index.updateData"), repeat: msg("coze.index.repeat"), break: msg("coze.index.breakLoop"), continue: msg("coze.index.nextIteration"),
  plugin: msg("coze.index.toolCall"), table_query: msg("coze.index.queryData"), table_write: msg("coze.index.writeData"), table_delete: msg("coze.index.deleteData"),
};

/**
 * Creates a node with default content. The name, prompts and sample values become user data,
 * so they are localized once here (current UI language by default) and never re-translated.
 */
export function newNode(type: string, index: number, t: Translate = currentTranslate): Node {
  const config: Record<string, Record<string, Json>> = {
    input: { prompt: t("coze.index.provideTheFollowingInformation"), fields: [{ name: "answer", description: t("coze.index.answer"), kind: "string", required: true }], choices: [] },
    output: { value: "{{input.text}}" }, variable: { variable_name: "result", value: "{{input.text}}" },
    aggregate: { values: ["{{input.text}}"] }, aggregate_groups: { groups: { result: ["{{input.text}}"] } },
    conversation: { operation: "create", input: { title: t("coze.index.newConversation") } },
    sql: { table_ids: [], sql: "SELECT * FROM t1 LIMIT 100" },
    nl2sql: { table_ids: [], model: "", question: "{{input.text}}" },
    intent: { model: "", query: "{{input.text}}", intents: [t("coze.index.inquiry"), t("coze.index.feedback")] },
    knowledge_write: { knowledge_id: "", document_name: t("coze.index.newDocument"), text: "{{input.text}}" },
    knowledge_delete: { knowledge_id: "", document_ids: [] },
    table_update: { table_id: "", row_id: "{{input.id}}", value: "{{input.value}}" },
    repeat: { workflow_id: "", count: 3 }, break: {}, continue: {},
    code: { code: "return { result: input.text };", input: "{{input}}", language: "javascript", entrypoint: false },
    plugin: { plugin_id: "", input: "{{input}}" },
    table_query: { table_id: "", filter: {} }, table_write: { table_id: "", value: "{{input}}" },
    table_delete: { table_id: "", row_id: "{{input.id}}" },
    llm: { model: "", prompt: "{{input.text}}", system: "", temperature: 0.7 },
    knowledge: { knowledge_ids: [], query: "{{input.text}}", limit: 6 },
    template: { template: "{{input.text}}" },
    condition: { left: "{{input.text}}", right: "", operator: "equal" },
    http: { url: "https://", method: "GET", body: {} },
    json_parse: { text: "{{input.text}}" }, json_stringify: { value: "{{input}}" },
    subworkflow: { workflow_id: "", input: "{{input}}" },
    loop: { workflow_id: "", items: "{{input.items}}" }, end: { value: "{{input}}" },
  };
  // An unknown type (only its id is used, e.g. by node duplication) falls back to the type id.
  return { id: `node_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
    name: Object.hasOwn(nodeLabels, type) ? t(nodeLabels[type]) : type,
    x: 40 + (index % 4) * 250, y: 220 + Math.floor(index / 4) * 140, type, ...config[type] };
}
