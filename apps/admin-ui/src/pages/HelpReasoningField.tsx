import EFFORT_LABELSResource from '@remoteai/i18n/copy/admin/helpEffortLabels';
import inlineCopy from '@remoteai/i18n/copy/inline/admin/pages/HelpReasoningField';
import { Select, Typography } from "antd";
import type { HelpReasoningEffort } from "../hooks/useHelpSettings";

const EFFORT_LABELS: Record<HelpReasoningEffort, string> = EFFORT_LABELSResource;

export function HelpReasoningField({ value, disabled, zh, onChange }: {
  value: HelpReasoningEffort | undefined;
  disabled: boolean;
  zh: boolean;
  onChange: (effort: HelpReasoningEffort) => void;
}) {
  return <div>
    <Typography.Paragraph>{zh ? inlineCopy["text_c8c14507"] : inlineCopy["Reasoning_effort_3236aeec"]}</Typography.Paragraph>
    <Select aria-label={zh ? inlineCopy["text_c8c14507"] : inlineCopy["Reasoning_effort_3236aeec"]} value={value} disabled={disabled}
      style={{ width: "100%", maxWidth: 400 }} onChange={onChange}
      options={Object.entries(EFFORT_LABELS).map(([effort, label]) => ({
        value: effort, label: zh ? `${label}（${effort}）` : effort,
      }))} />
    <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>{zh
      ? inlineCopy["text_7aeed7a9"]
      : inlineCopy["Higher_effort_usually_takes_longer_13b1af30"]}
    </Typography.Paragraph>
  </div>;
}
