import { Alert, Input, Select, Space, Tabs, Typography } from "antd";
import { useState } from "react";
import { useT, type Translate } from "../i18n";
import type { Resource } from "../types";

/** Sample request body; field names are the API contract, only the sample text is localized. */
function exampleInput(resource: Resource, t: Translate): Record<string, unknown> {
  if (resource.kind === "agent") return { message: t("coze.agents.hello") };
  if (resource.kind === "knowledge") return { query: t("coze.agents.yourQuestion") };
  if (resource.kind === "table") return { input: { filter: {} } };
  return { input: {} };
}

export function ConnectionExamples({ resource, urls, token }: {
  resource: Resource; urls: string[]; token?: string;
}) {
  const t = useT();
  const [selected, setSelected] = useState("");
  const address = urls.includes(selected) ? selected : urls[0];
  if (!address) return null;
  const authorization = `Bearer ${token || "YOUR_TOOL_KEY"}`;
  const config = JSON.stringify({ mcpServers: { coze: {
    url: `${address}/mcp`, headers: { Authorization: authorization },
  } } }, null, 2);
  const request = `POST ${address}/api/run\nAuthorization: ${authorization}\nContent-Type: application/json\n\n`
    + JSON.stringify(exampleInput(resource, t), null, 2);
  const code = (text: string) => <>
    <Typography.Paragraph copyable={{ text }}>{t("coze.agents.copyConfiguration")}</Typography.Paragraph>
    <Input.TextArea readOnly value={text} autoSize={{ minRows: 4, maxRows: 12 }} />
  </>;
  return <div>
    <Space wrap><span>{t("coze.agents.connectionAddress")}</span><Select aria-label={t("coze.agents.connectionAddress")} value={address}
      onChange={setSelected} style={{ minWidth: 250 }} options={urls.map((url, index) => ({
        value: url, label: `${index === 0 ? t("coze.agents.thisComputer") : t("coze.agents.otherComputers")} · ${url}`,
      }))} /></Space>
    {!token && <p>{t("coze.agents.replaceYourToolKeyInTheExamplesWithTheAccess")}</p>}
    <Tabs items={[{ key: "mcp", label: t("coze.agents.mcpClient"), children: <>
      <p>{t("coze.agents.addAnHttpMcpServerWithThisAddressAndThe")}</p>
      {code(config)}</> }, { key: "api", label: "HTTP API", children: <>
      <p>{t("coze.agents.thisKeyAutomaticallySelectsFillInTheParametersThatThe", { name: resource.name })}</p>
      {code(request)}
      <Alert type="info" message={t("coze.agents.workflowsUseInputAgentsUseMessageAndKnowledgeBasesUse")}
        description={t("coze.agents.whenARunPausesForAnAnswerSendRunId")} />
    </> }]} />
  </div>;
}
