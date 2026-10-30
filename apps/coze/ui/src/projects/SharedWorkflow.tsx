import { displayError } from '../i18n/index';
import { useEffect, useState } from "react";
import { Alert, Button, Input, Select, Space, Typography } from "antd";
import { api, errorText } from "../api";
import { formatDateTime, msg, useT } from "../i18n";
import type { Json, Resource } from "../types";
import { useWorkflowExecution, type Run } from "../workflow/useWorkflowExecution";
import { RunResult } from "../workflow/RunResult";

export function SharedWorkflow({ resourceId, published = true, save }: {
  resourceId: string; published?: boolean; save?: () => Promise<Resource>;
}) {
  const t = useT();
  // Sample input: only the value is localized, once; the field name is the workflow's input name.
  const [input, setInput] = useState(() => JSON.stringify({ text: t("coze.agents.hello") }));
  const [history, setHistory] = useState<Run[]>([]);
  const execution = useWorkflowExecution();
  useEffect(() => {
    if (execution.busy) return;
    let active = true;
    void api<Run[]>("runs", { id: resourceId }).then((runs) => { if (active) setHistory(runs); })
      .catch((error: unknown) => { if (active) execution.setError(errorText(error)); });
    return () => { active = false; };
  }, [execution.busy, resourceId]);
  const run = async () => {
    execution.setError("");
    try {
      const value: unknown = JSON.parse(input);
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(msg("coze.index.enterACompleteSetOfInputs"));
      if (save) await save();
      await execution.start("run_start", { resourceId, input: value, published });
    } catch (error) { execution.setError(errorText(error)); }
  };
  const resume = (runId: string, interactionId: string, input: Json) => {
    void execution.start("resume_run_start", { runId, interactionId, input });
  };
  const runLabel = (run: Run) => {
    const date = run.createdAt ? formatDateTime(run.createdAt) : t("coze.index.runHistory");
    return run.status === "paused" ? t("coze.index.waitingForAReply", { date }) : date;
  };
  return <section className="panel"><h2>{published ? t("coze.index.useTheApp") : t("coze.index.workflowPreview")}</h2>
    <Select placeholder={t("coze.index.myRuns")} allowClear disabled={execution.busy} style={{ minWidth: 260 }}
      value={execution.run?.id} options={history.map((run) => ({ value: run.id, label: runLabel(run) }))}
      onChange={(id: string | undefined) => execution.setRun(history.find((run) => run.id === id))} />
    {execution.error && <Alert type="error" message={displayError(execution.error)} closable onClose={() => execution.setError("")} />}
    <Typography.Paragraph>{t("coze.index.enterTheInputTheAppNeedsThenStartTheRun")}</Typography.Paragraph>
    <Input.TextArea value={input} onChange={(event) => setInput(event.target.value)} rows={5} aria-label={t("coze.index.appInput")} />
    <Space><Button type="primary" loading={execution.busy} onClick={() => void run()}>{t("coze.index.run")}</Button>
      {execution.busy && <Button onClick={() => void execution.cancel()}>{t("coze.core.stop")}</Button>}</Space>
    {execution.text && <pre className="run-output">{execution.text}</pre>}
    {execution.run && <RunResult run={execution.run} busy={execution.busy} onResume={resume} />}
  </section>;
}
