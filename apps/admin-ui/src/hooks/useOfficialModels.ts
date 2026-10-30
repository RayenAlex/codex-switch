import inlineCopy from '@remoteai/i18n/copy/inline/admin/hooks/useOfficialModels';
import { useEffect, useMemo, useRef, useState } from "react";
import { App } from "antd";
import { catalogErrorMessage, parseCatalog } from "../pages/official-models/catalog";

export interface OfficialModelsSnapshot {
  catalog: Record<string, unknown> | null;
  revision: string;
  updatedAt: string;
  source: string;
}
export interface OfficialModelsProps {
  api: <T>(path: string, options?: RequestInit) => Promise<T>;
  canManage: boolean;
}
const ENDPOINT = "/admin/api/official-models";
const noticeStyle = { maxWidth: 400, whiteSpace: "normal" as const };

export function useOfficialModels(api: OfficialModelsProps["api"], zh: boolean) {
  const { message } = App.useApp();
  const [snapshot, setSnapshot] = useState<OfficialModelsSnapshot | null>(null);
  const [draft, setDraft] = useState("");
  const parsed = useMemo(() => parseCatalog(draft), [draft]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<"save" | "refresh" | null>(null);
  const [attempt, setAttempt] = useState(0);
  const active = useRef(true);
  const pending = useRef(false);
  const accept = (value: OfficialModelsSnapshot) => {
    setSnapshot(value);
    setDraft(JSON.stringify(value.catalog ?? { models: [] }, null, 2));
  };

  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    let current = true;
    setLoading(true);
    void api<OfficialModelsSnapshot>(ENDPOINT).then((value) => { if (current) accept(value); })
      .catch(() => {
        if (current) message.error({ content: zh ? inlineCopy["text_1d7ca64d"]
          : inlineCopy["Unable_to_load_models_Please_b01795f5"], style: noticeStyle });
      }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [api, attempt, message, zh]);

  const submit = async (operation: "save" | "refresh") => {
    if (pending.current || !snapshot) return;
    let body: string | undefined;
    if (operation === "save") {
      if (parsed.error) {
        message.error({ content: catalogErrorMessage(parsed.error, zh), style: noticeStyle });
        return;
      }
      body = JSON.stringify({ catalog: parsed.catalog, revision: snapshot.revision });
    }
    pending.current = true;
    setAction(operation);
    try {
      const value = await api<OfficialModelsSnapshot>(operation === "save" ? ENDPOINT : `${ENDPOINT}/refresh`,
        { method: operation === "save" ? "PATCH" : "POST", body });
      if (!active.current) return;
      accept(value);
      message.success({ content: zh ? inlineCopy["text_a9087a19"] : inlineCopy["Model_list_updated_16afd2f1"], style: noticeStyle });
    } catch (error) {
      if (active.current) message.error({ content: error instanceof Error ? error.message
        : (zh ? inlineCopy["text_71d7ddd0"] : inlineCopy["Unable_to_update_Please_retry_1cf5eb92"]), style: noticeStyle });
    } finally {
      pending.current = false;
      if (active.current) setAction(null);
    }
  };
  return { snapshot, draft, parsed, setDraft, loading, action, submit, reload: () => setAttempt((value) => value + 1) };
}
