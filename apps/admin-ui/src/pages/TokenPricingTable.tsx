import inlineCopy from '@remoteai/i18n/copy/inline/admin/pages/TokenPricingTable';
import { Input, InputNumber, Switch, Table } from "antd";
import {
  DEFAULT_LONG_CONTEXT_THRESHOLD_TOKENS, MAX_LONG_CONTEXT_THRESHOLD_TOKENS, type TokenCostPreset,
} from "../../../../shared/token-cost-presets";

export interface PricingRow extends TokenCostPreset { key: string }
interface Props {
  rows: PricingRow[];
  onChange: (rows: PricingRow[]) => void;
  disabled: boolean;
  zh: boolean;
}
type NumericField = "input" | "cachedInput" | "output" | "fastModeMultiplier";

export function TokenPricingTable({ rows, onChange, disabled, zh }: Props) {
  const update = (key: string, patch: Partial<PricingRow>) => onChange(rows.map(
    (row) => row.key === key ? { ...row, ...patch } : row,
  ));
  const price = (row: PricingRow, field: NumericField) => <InputNumber
    aria-label={row.model + " " + field} value={row[field]} disabled={disabled}
    min={field === "fastModeMultiplier" ? 0.01 : 0} max={field === "fastModeMultiplier" ? 100 : 1_000_000_000}
    placeholder={zh ? inlineCopy["text_f5175272"] : inlineCopy["Not_listed_e2dcbd03"]}
    onChange={(value) => update(row.key, { [field]: field === "fastModeMultiplier" ? value : value ?? 0 })} style={{ width: 105 }} />;
  return <Table rowKey="key" dataSource={rows} pagination={false} scroll={{ x: 1300 }} size="small"
    columns={[
      { title: zh ? inlineCopy["text_c98e118e"] : inlineCopy["Model_5e2c614c"], key: "model", width: 190, render: (_, row) => <Input
        value={row.model} disabled={disabled} aria-label={zh ? inlineCopy["text_cb2f1709"] : inlineCopy["Model_name_a3c3370c"]}
        onChange={(event) => update(row.key, { model: event.target.value.trim().toLowerCase() })} /> },
      { title: zh ? inlineCopy["text_76a695f2"] : inlineCopy["Aliases_comma_separated_732ccf29"], key: "aliases", width: 190,
        render: (_, row) => <Input defaultValue={(row.aliases ?? []).join(", ")} disabled={disabled}
          aria-label={row.model + " aliases"} onBlur={(event) => update(row.key, {
            aliases: event.target.value.split(",").map((alias) => alias.trim().toLowerCase()).filter(Boolean),
          })} /> },
      { title: zh ? inlineCopy["text_2087c777"] : inlineCopy["Input_36ecb4f8"], key: "input", render: (_, row) => price(row, "input") },
      { title: zh ? inlineCopy["text_39f52eee"] : inlineCopy["Cached_input_876a4379"], key: "cachedInput", render: (_, row) => price(row, "cachedInput") },
      { title: zh ? inlineCopy["text_fb04addb"] : inlineCopy["Output_b2439bcb"], key: "output", render: (_, row) => price(row, "output") },
      { title: zh ? inlineCopy["text_c1ccc428"] : inlineCopy["Long_context_45aa7e73"], key: "longContext", render: (_, row) => <Switch
        checked={row.longContextPricing} disabled={disabled} aria-label={row.model + " long context"}
        onChange={(value) => update(row.key, { longContextPricing: value })} /> },
      { title: zh ? inlineCopy["Token_57ef123a"] : inlineCopy["Longcontext_threshold_tokens_7e22705f"], key: "longContextThreshold",
        width: 180, render: (_, row) => <InputNumber value={row.longContextThresholdTokens}
          disabled={disabled || !row.longContextPricing} min={1} max={MAX_LONG_CONTEXT_THRESHOLD_TOKENS}
          precision={0} placeholder={String(DEFAULT_LONG_CONTEXT_THRESHOLD_TOKENS)}
          aria-label={row.model + " longContextThresholdTokens"} style={{ width: 140 }}
          onChange={(value) => update(row.key, { longContextThresholdTokens: value })} /> },
      { title: zh ? inlineCopy["text_c72e16e8"] : inlineCopy["Price_source_URL_8e7c6e18"], key: "source", width: 190, render: (_, row) => <Input
        value={row.sourceUrl} disabled={disabled} placeholder="https://" aria-label={row.model + " source"}
        onChange={(event) => update(row.key, { sourceUrl: event.target.value.trim() })} /> },
      { title: zh ? inlineCopy["text_10b99c2c"] : inlineCopy["Fast_mode_multiplier_1c436136"], key: "fastModeMultiplier",
        render: (_, row) => price(row, "fastModeMultiplier") },
    ]} />;
}
