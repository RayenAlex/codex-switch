import { displayText } from '../i18n/index';
import { Handle, Position, type Node as FlowNode, type NodeProps } from "@xyflow/react";
import { BookOpen, Bot, Braces, Flag, GitBranch, Play, Wrench } from "lucide-react";
import type { Node } from "../types";
import { useT, type Translate } from "../i18n";
import { isTerminal } from "./graphEditing";
import { nodeLabels } from "./nodes";

export type CanvasNode = FlowNode<{ node: Node }, "workflow">;

/** Translated node type name; node names themselves are user data and stay as saved. */
function typeLabel(t: Translate, type: string): string | undefined {
  return Object.prototype.hasOwnProperty.call(nodeLabels, type) ? displayText(nodeLabels[type]) : undefined;
}

function nodeSummary(node: Node, t: Translate): string {
  if (node.type === "start") return t("coze.index.workflowInput");
  if (node.type === "condition") return `${node.left ?? ""} · ${node.operator ?? "equal"} · ${node.right ?? ""}`;
  if (node.type === "llm" || node.type === "intent" || node.type === "nl2sql") {
    return String(node.model || t("coze.index.chooseAModel"));
  }
  if (node.type === "knowledge") {
    return t("coze.index.knowledgeBasesSelected", { count: Array.isArray(node.knowledge_ids) ? node.knowledge_ids.length : 0 });
  }
  const content = node.template ?? node.prompt ?? node.query ?? node.value ?? node.url;
  return typeof content === "string" ? content : typeLabel(t, node.type) ?? node.type;
}

export function WorkflowNode({ data, selected }: NodeProps<CanvasNode>) {
  const { node } = data;
  const t = useT();
  const icons = { start: Play, end: Flag, llm: Bot, knowledge: BookOpen, condition: GitBranch, code: Braces };
  const Icon = icons[node.type as keyof typeof icons] ?? Wrench;
  // Port names are also the e2e selectors; they stay "{name} 输入端口" etc. in Chinese.
  return <div className={`workflow-node ${selected ? "is-selected" : ""}`}>
    {node.type !== "start" && <Handle type="target" id="input" position={Position.Left}
      aria-label={t("coze.index.inputPort", { name: node.name })} />}
    <header><span className={`node-icon node-icon-${node.type}`}><Icon size={16} /></span>
      <strong>{node.name}</strong><small>{typeLabel(t, node.type)}</small></header>
    <p>{nodeSummary(node, t)}</p>
    {node.type === "condition" ? <div className="branch-ports">
      <div>{t("coze.index.ifTrue")}<Handle type="source" id="true" position={Position.Right}
        aria-label={t("coze.index.trueBranchPort", { name: node.name })} /></div>
      <div>{t("coze.index.ifFalse")}<Handle type="source" id="false" position={Position.Right}
        aria-label={t("coze.index.falseBranchPort", { name: node.name })} /></div>
    </div> : !isTerminal(node.type) && <Handle type="source" id="output" position={Position.Right}
      aria-label={t("coze.index.outputPort", { name: node.name })} />}
  </div>;
}
