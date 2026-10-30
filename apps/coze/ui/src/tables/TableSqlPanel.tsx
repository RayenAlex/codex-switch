import { displayError } from '../i18n/index';
import { useEffect, useState } from "react";
import { Alert, Button, Input, Select, Space, Table } from "antd";
import { api, errorText } from "../api";
import { useT } from "../i18n";
import type { Json, Model, Resource } from "../types";

interface QueryResult { columns: string[]; rows: Json[][]; truncated: boolean }

export function TableSqlPanel({ resource }: { resource: Resource }) {
  const t = useT();
  const [tables, setTables] = useState<Resource[]>([resource]);
  const [selected, setSelected] = useState<string[]>([resource.id]);
  const [models, setModels] = useState<Model[]>([]);
  const [model, setModel] = useState("");
  const [question, setQuestion] = useState("");
  const [sql, setSql] = useState("SELECT * FROM t1 LIMIT 100");
  const [result, setResult] = useState<QueryResult>();
  const [busy, setBusy] = useState("");
  // Holds the untranslated server message; translated when rendered.
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void api<Resource[]>("list_resources").then((resources) => {
      if (active) setTables(resources.filter((item) => item.kind === "table"));
    }).catch((error: unknown) => { if (active) setError(errorText(error)); });
    void api<Model[]>("models").then((items) => { if (active) setModels(items); }).catch(() => {
      // SQL queries do not need a model; only natural-language generation does.
    });
    return () => { active = false; };
  }, []);
  const generate = async () => {
    setBusy("generate"); setError("");
    try {
      const result = await api<{ sql: string }>("generate_table_sql", { tables: selected, question, model });
      setSql(result.sql); setResult(undefined);
    } catch (error) { setError(errorText(error)); } finally { setBusy(""); }
  };
  const run = async () => {
    setBusy("query"); setError(""); setResult(undefined);
    try { setResult(await api<QueryResult>("table_sql", { tables: selected, sql })); }
    catch (error) { setError(errorText(error)); } finally { setBusy(""); }
  };
  const names = new Map(tables.map((table) => [table.id, table.name]));
  return <Space direction="vertical" style={{ width: "100%" }}>
    <p>{t("coze.index.chooseTheTablesToQueryWriteSqlYourselfOrLet")}</p>
    {error && <Alert type="error" message={displayError(error)} />}
    <Select mode="multiple" aria-label={t("coze.index.tablesToQuery")} value={selected} style={{ width: "100%" }}
      disabled={Boolean(busy)} onChange={setSelected} maxCount={8}
      options={tables.map((table) => ({ value: table.id, label: table.name }))} />
    {/* The separator is a translated key: Chinese keeps "；", other languages use "; ". */}
    <small>{selected.map((id, index) => `t${index + 1} = ${names.get(id) ?? id}`).join(t("coze.index.message.b0d3c9"))}</small>
    <Select aria-label={t("coze.index.queryGenerationModel")} value={model || undefined} placeholder={t("coze.index.chooseAModelToInterpretTheQuestion")}
      style={{ width: "100%" }} onChange={setModel} disabled={Boolean(busy)} showSearch
      options={models.map((item) => ({ value: item.id, label: item.name }))} />
    <Input.TextArea aria-label={t("coze.index.questionAboutTheData")} value={question} rows={2} maxLength={2000}
      placeholder={t("coze.index.forExampleThisMonthSSalesByCityHighestFirst")} onChange={(event) => setQuestion(event.target.value)} />
    <Button loading={busy === "generate"} disabled={Boolean(busy) || !model || !question.trim() || !selected.length}
      onClick={() => void generate()}>{t("coze.index.generateQuery")}</Button>
    <Input.TextArea aria-label={t("coze.index.sqlQuery")} value={sql} rows={5} onChange={(event) => setSql(event.target.value)} />
    <Button type="primary" loading={busy === "query"} disabled={Boolean(busy) || !sql.trim() || !selected.length}
      onClick={() => void run()}>{t("coze.index.runQuery")}</Button>
    <small>{t("coze.index.queriesDonTChangeRecordsAfterGeneratingAQueryCheck")}</small>
    {result?.truncated && <Alert type="info" message={t("coze.index.showingTheFirst1000ResultsNarrowTheQueryTo")} />}
    {result && <Table size="small" scroll={{ x: true }} pagination={{ pageSize: 20 }}
      rowKey="key" dataSource={result.rows.map((values, index) => ({ key: index, values }))}
      columns={result.columns.map((title, index) => ({ title, key: index,
        render: (_value: unknown, row: { values: Json[] }) => typeof row.values[index] === "object"
          ? JSON.stringify(row.values[index]) : String(row.values[index] ?? ""),
      }))} />}
  </Space>;
}
