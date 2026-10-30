import inlineCopy from '@remoteai/i18n/copy/inline/admin/pages/TokenPricingPage';
import { useEffect, useState } from "react";
import { App, Button, Card, Space, Typography } from "antd";
import { Plus } from "lucide-react";
import {
  isTokenCostPresetDocument, type TokenCostPresetDocument,
} from "../../../../shared/token-cost-presets";
import { useI18n } from "../i18n-context";
import { TokenPricingTable, type PricingRow } from "./TokenPricingTable";

interface Props {
  api: <T>(path: string, options?: RequestInit) => Promise<T>;
  canManage: boolean;
}
const ENDPOINT = "/admin/api/token-cost-presets";
const noticeStyle = { maxWidth: 400, whiteSpace: "normal" as const };

export function TokenPricingPage({ api, canManage }: Props) {
  const { language } = useI18n();
  const zh = language === "zh";
  const { message } = App.useApp();
  const [document, setDocument] = useState<TokenCostPresetDocument | null>(null);
  const [rows, setRows] = useState<PricingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    void api<unknown>(ENDPOINT).then((value) => {
      if (!isTokenCostPresetDocument(value)) throw new Error("Invalid presets");
      if (!active) return;
      setDocument(value);
      setRows(value.models.map((model) => ({ ...model, key: crypto.randomUUID() })));
    }).catch(() => {
      if (active) message.error({ content: zh ? inlineCopy["text_cb896e33"] : inlineCopy["Unable_to_load_pricing_presets_57877aab"],
        style: noticeStyle });
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, attempt, message, zh]);

  const save = async () => {
    if (!document || saving) return;
    const updated = { ...document, models: rows.map(({ key: _key, ...model }) => model) };
    if (!isTokenCostPresetDocument(updated)) {
      message.error({ content: zh ? inlineCopy["text_e09daea1"]
        : inlineCopy["Check_names_aliases_prices_thresholds_7de4587c"],
      style: noticeStyle });
      return;
    }
    setSaving(true);
    try {
      const saved = await api<TokenCostPresetDocument>(ENDPOINT, { method: "PATCH", body: JSON.stringify(updated) });
      setDocument(saved);
      message.success({ content: zh ? inlineCopy["PC_38b2249c"]
        : inlineCopy["Saved_Applies_when_users_next_f234aed8"], style: noticeStyle });
    } catch { message.error({ content: zh ? inlineCopy["text_3461df8d"] : inlineCopy["Unable_to_save_Please_retry_aa2c25e7"], style: noticeStyle }); }
    finally { setSaving(false); }
  };
  const add = () => setRows((current) => [...current, {
    key: crypto.randomUUID(), model: "", aliases: [], input: 0, cachedInput: 0, output: 0,
    fastModeMultiplier: null, longContextPricing: false, sourceUrl: "",
  }]);

  return <Space direction="vertical" size="large" style={{ width: "100%" }}>
    <div>
      <Typography.Title level={2}>{zh ? inlineCopy["text_ee7d0848"] : inlineCopy["Model_pricing_presets_e28631d6"]}</Typography.Title>
      <Typography.Paragraph type="secondary">{zh
        ? inlineCopy["Token_PC_c7ac90e6"]
        : inlineCopy["Prices_are_USD_per_million_550822e6"]}
      </Typography.Paragraph>
      <Typography.Text type="secondary">{zh
        ? inlineCopy["272000_Token_ef06f97d"]
        : inlineCopy.descriptionEn}
      </Typography.Text>
      <Typography.Paragraph type="secondary">{zh
        ? inlineCopy["text_a9e7449e"]
        : inlineCopy["Set_Fast_mode_multipliers_per_0c8304e6"]}
      </Typography.Paragraph>
    </div>
    <Card loading={loading}>
      <TokenPricingTable rows={rows} onChange={setRows} disabled={!canManage || saving || !document} zh={zh} />
      <Space style={{ marginTop: 16 }}>
        {!document && <Button onClick={() => setAttempt((value) => value + 1)}>
          {zh ? inlineCopy["text_7bdd5ce1"] : inlineCopy["Reload_bdc090ec"]}</Button>}
        {canManage && <Button icon={<Plus size={16} />} disabled={!document || saving} onClick={add}>
          {zh ? inlineCopy["text_168e845a"] : inlineCopy["Add_model_b2609f7d"]}</Button>}
        {canManage && <Button type="primary" loading={saving} disabled={!document} onClick={() => void save()}>
          {zh ? inlineCopy["text_3ab57dd1"] : inlineCopy["Save_presets_b192d57b"]}</Button>}
      </Space>
    </Card>
  </Space>;
}
