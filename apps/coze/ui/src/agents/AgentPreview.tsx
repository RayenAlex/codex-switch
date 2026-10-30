import { displayError } from '../i18n/index';
import { useState } from "react";
import { Alert, Button, Empty, Input, Select, Space, Tag } from "antd";
import { Plus, Send, Square } from "lucide-react";
import { useT } from "../i18n";
import type { Draft, Resource } from "../types";
import { useAgentChat } from "./useAgentChat";

interface Props { resource: Resource; draft: Draft; save?: () => Promise<Resource>; published?: boolean }

export function AgentPreview({ resource, draft, save, published }: Props) {
  const chat = useAgentChat({ resourceId: resource.id, save, published });
  const t = useT();
  const [input, setInput] = useState("");
  const send = async () => { if (await chat.send(input)) setInput(""); };
  return <section className="panel chat-preview"><header><h2>{t("coze.agents.chatPreview")}</h2><Space wrap>
    <Select placeholder={t("coze.agents.chatHistory")} allowClear value={chat.conversation} disabled={chat.busy} style={{ width: 180 }}
      options={chat.conversations.map((item) => ({ value: item.id, label: item.title }))}
      onChange={(id: string | undefined) => void chat.selectConversation(id)} />
    <Button icon={<Plus size={14} />} disabled={chat.busy} onClick={() => void chat.selectConversation()}>
      {t("coze.agents.newChat")}</Button></Space></header>
    {chat.error && <Alert type="info" message={displayError(chat.error)} closable onClose={chat.clearError} />}
    <div className="chat-messages">
      {!chat.messages.length && !chat.busy && <Empty description={t("coze.agents.sendAMessageToSeeHowItResponds")} />}
      {chat.messages.map((message, index) => message.role === "tool"
        ? <details key={index}><summary>{t("coze.agents.toolResult")}</summary><pre style={{ whiteSpace: "pre-wrap" }}>
          {message.content}</pre></details>
        : <article key={index} className={`chat-message ${message.role}`}>
          <strong>{message.role === "user" ? t("coze.agents.you") : resource.name}</strong><p>{message.content}</p>
          {message.citations.map((citation, index) => <details key={citation.chunkId}>
            <summary>[{index + 1}] {citation.documentName}</summary><p>{citation.text}</p></details>)}
        </article>)}
      {chat.traces.length > 0 && <details open={chat.busy}><summary>
        {t("coze.agents.toolCallsThisTurn", { count: chat.traces.length })}</summary>
        {chat.traces.map((trace) => <details key={trace.id}><summary>
          {trace.output === undefined ? t("coze.agents.running") : t("coze.agents.returned")} · {trace.name}</summary>
          <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify({ input: trace.input, output: trace.output }, null, 2)}</pre>
        </details>)}
      </details>}
      {(chat.live || chat.busy) && <article className="chat-message assistant" aria-live="polite">
        <strong>{resource.name}</strong>{chat.busy && <Tag>
          {chat.step > 1 ? t("coze.agents.answeringRound", { step: chat.step }) : t("coze.agents.answering")}</Tag>}
        <p>{chat.live || t("coze.agents.preparing")}</p></article>}
    </div>
    <Input.TextArea value={input} rows={3} placeholder={t("coze.agents.typeAMessage")} disabled={chat.busy}
      onChange={(event) => setInput(event.target.value)} />
    <Space><Button type="primary" icon={<Send size={15} />} loading={chat.busy} disabled={!input.trim() || !draft.model}
      onClick={() => void send()}>{t("coze.agents.send")}</Button>
      {chat.busy && <Button icon={<Square size={14} />} onClick={() => void chat.cancel()}>{t("coze.core.stop")}</Button>}
    </Space>
  </section>;
}
