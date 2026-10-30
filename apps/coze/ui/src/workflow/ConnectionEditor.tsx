import { displayError } from '../i18n/index';
import { useState } from "react";
import { App, Button, Select } from "antd";
import type { Edge, Graph, Node } from "../types";
import { useT, type Translate } from "../i18n";
import { connectionError, edgeId } from "./graphEditing";

/** One message per branch so the whole button text is translated as a sentence. */
function removeLabel(t: Translate, edge: Edge, target: string): string {
  if (edge.port == null) return t("coze.index.removeConnection", { target });
  return edge.port ? t("coze.index.removeTrueBranch", { target }) : t("coze.index.removeFalseBranch", { target });
}

export function ConnectionEditor({ node, graph, onChange }: {
  node: Node; graph: Graph; onChange: (graph: Graph) => void;
}) {
  const [target, setTarget] = useState<string>();
  const [port, setPort] = useState(true);
  const { message } = App.useApp();
  const t = useT();
  return <details className="connection-controls"><summary>{t("coze.index.connectToTheNextStep")}</summary>
    <small>{t("coze.index.youCanAlsoDragTheDotsOnTheCanvasTo")}</small>
    {node.type === "condition" && <Select className="full" value={String(port)}
      options={[{ value: "true", label: t("coze.index.ifTrue") }, { value: "false", label: t("coze.index.ifFalse") }]}
      onChange={(value) => setPort(value === "true")} />}
    <Select className="full" placeholder={t("coze.index.chooseANodeToConnectTo")} value={target} onChange={setTarget}
      options={graph.nodes.filter((item) => item.id !== node.id && item.type !== "start")
        .map((item) => ({ value: item.id, label: item.name }))} />
    <Button disabled={!target} onClick={() => {
      if (!target) return;
      const edge = { source: node.id, target, ...(node.type === "condition" ? { port } : {}) };
      const error = connectionError(graph, edge);
      if (error) { void message.info(displayError(error)); return; }
      onChange({ ...graph, edges: [...graph.edges, edge] }); setTarget(undefined);
    }}>{t("coze.index.connect")}</Button>
    {graph.edges.filter((edge) => edge.source === node.id).map((edge) => <Button key={edgeId(edge)}
      type="text" danger onClick={() => onChange({ ...graph, edges: graph.edges.filter((item) => item !== edge) })}>
      {removeLabel(t, edge, graph.nodes.find((node) => node.id === edge.target)?.name ?? "")}</Button>)}
  </details>;
}
