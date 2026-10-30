import { displayText, displayError } from '../i18n/index';
import { useState } from "react";
import { Alert, Button, Input, Space, Tag } from "antd";
import type { Json } from "../types";
import { formatList, msg, useT } from "../i18n";
import type { Interaction, Run } from "./useWorkflowExecution";

/** Run status ids are protocol values; only the labels are translated, at render time. */
const statusLabels: Record<string, string> = {
  completed: msg("coze.index.completed"), paused: msg("coze.index.waitingForAReply.77ed55"), running: msg("coze.index.running"), failed: msg("coze.index.failed"),
  cancelled: msg("coze.index.stopped"), interrupted: msg("coze.index.interrupted"),
};
function emptyValue(kind: string): Json {
  switch (kind) {
    case "string": return "";
    case "boolean": return false;
    case "object": return {};
    case "array": return [];
    default: return 0;
  }
}
interface Props { run: Run; busy: boolean; onResume: (runId: string, interactionId: string, input: Json) => void }

export function RunResult({ run, busy, onResume }: Props) {
  const t = useT();
  const interaction = run.interaction;
  const status = Object.prototype.hasOwnProperty.call(statusLabels, run.status)
    ? displayText(statusLabels[run.status]) : run.status;
  // run.error is a Chinese runtime message from Rust (also persisted); the runtime area translates it.
  return <div className="run-result"><h3>{t("coze.index.runResult")} <Tag>{status}</Tag></h3>
    {run.error && <Alert type="error" message={displayError(run.error)} />}
    {run.status === "paused" && interaction && <InteractionForm key={interaction.id}
      interaction={interaction} busy={busy} onSubmit={(input) => onResume(run.id, interaction.id, input)} />}
    {run.output !== null && run.output !== undefined && <pre>{typeof run.output === "string"
      ? run.output : JSON.stringify(run.output, null, 2)}</pre>}
    <h3>{t("coze.index.nodeDetails")}</h3>{run.trace.map((trace, index) => <pre key={index}>{JSON.stringify(trace, null, 2)}</pre>)}
  </div>;
}

function InteractionForm({ interaction, busy, onSubmit }: {
  interaction: Interaction; busy: boolean; onSubmit: (input: Json) => void;
}) {
  const t = useT();
  const defaults = Object.fromEntries(interaction.fields.map((field) => [field.name, emptyValue(field.kind)]));
  const [text, setText] = useState(JSON.stringify(defaults, null, 2));
  const [invalid, setInvalid] = useState(false);
  const singleText = interaction.fields.length === 1 && interaction.fields[0].kind === "string";
  const [answer, setAnswer] = useState("");
  const submit = () => {
    if (singleText) { onSubmit({ [interaction.fields[0].name]: answer }); return; }
    try { const input = JSON.parse(text) as Json; setInvalid(false); onSubmit(input); }
    catch { setInvalid(true); }
  };
  return <div><p>{interaction.prompt}</p>
    {interaction.choices.length ? <Space wrap>{interaction.choices.map((choice) =>
      <Button key={choice} disabled={busy} onClick={() => onSubmit({ answer: choice })}>{choice}</Button>)}</Space>
      : <>{singleText ? <Input.TextArea aria-label={interaction.fields[0].description || t("coze.index.answer")} value={answer}
        onChange={(event) => setAnswer(event.target.value)} rows={3} /> : <>
        <p>{formatList(interaction.fields.map((field) => field.required
          ? t("coze.index.required.ad2940", { field: field.description || field.name }) : field.description || field.name))}</p>
        <Input.TextArea aria-label={t("coze.index.additionalInformation")} rows={6} value={text} status={invalid ? "error" : undefined}
          onChange={(event) => setText(event.target.value)} />
        {invalid && <small className="error-text">{t("coze.index.checkWhatYouEntered")}</small>}</>}
      <Button className="run-button" type="primary" loading={busy} onClick={submit}>{t("coze.index.continueRun")}</Button></>}
    <p><small>{t("coze.index.youCanContinueLaterFromRunHistoryCompletedStepsAre")}</small></p>
  </div>;
}
