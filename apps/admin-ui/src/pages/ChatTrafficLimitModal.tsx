import inlineCopy from '@remoteai/i18n/copy/inline/admin/pages/ChatTrafficLimitModal';
import { useState } from "react";
import { Alert, App, InputNumber, Modal, Select, Space, Typography } from "antd";
import type { TrafficApi, UserChatTraffic } from "../chat-traffic-types";
import { useI18n } from "../i18n-context";

const UNITS = [{ value: 1, label: "B" }, { value: 1024 ** 2, label: "MB" }, { value: 1024 ** 3, label: "GB" }];

export function ChatTrafficLimitModal({ user, api, onClose, onSaved }: {
  user: UserChatTraffic; api: TrafficApi; onClose: () => void; onSaved: () => void;
}) {
  const { language } = useI18n();
  const zh = language === "zh";
  const { message } = App.useApp();
  const [value, setValue] = useState<number | null>(user.monthlyLimitBytes);
  const [unit, setUnit] = useState(1);
  const [saving, setSaving] = useState(false);
  const bytes = value === -1 ? -1 : value === null ? NaN : value * unit;
  const valid = Number.isSafeInteger(bytes) && bytes >= -1 && (value === -1 || Number(value) >= 0);
  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await api(`/admin/api/chat-traffic/users/${user.id}/limit`, {
        method: "PATCH", body: JSON.stringify({ monthlyLimitBytes: bytes }),
      });
      message.success({ content: zh ? inlineCopy["text_a2e4e361"] : inlineCopy["Monthly_relay_allowance_updated_1566b7f7"],
        style: { maxWidth: 400 } });
      onSaved();
      onClose();
    } catch {
      message.error({ content: zh ? inlineCopy["text_3461df8d"] : inlineCopy["Unable_to_save_Please_retry_aa2c25e7"], style: { maxWidth: 400 } });
    } finally { setSaving(false); }
  };
  return <Modal open title={zh ? inlineCopy["text_e2c5022d"] : inlineCopy["Monthly_relay_allowance_6c0d21f0"]} width={400}
    onCancel={onClose} onOk={() => void save()} confirmLoading={saving} okButtonProps={{ disabled: !valid }}
    cancelButtonProps={{ disabled: saving }} closable={!saving} maskClosable={!saving} keyboard={!saving}>
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Typography.Text style={{ overflowWrap: "anywhere" }}>{user.email}</Typography.Text>
      <Space.Compact style={{ width: "100%" }}>
        <InputNumber aria-label={zh ? inlineCopy["text_2f9c4e52"] : inlineCopy["Monthly_relay_allowance_6c0d21f0"]} value={value} min={-1}
          onChange={setValue} style={{ width: "100%" }} disabled={saving} />
        <Select aria-label={zh ? inlineCopy["text_23bf07ce"] : inlineCopy["Traffic_unit_e8fcf481"]} value={unit} options={UNITS}
          onChange={setUnit} style={{ width: 90 }} disabled={saving} />
      </Space.Compact>
      <Typography.Text type="secondary">{zh ? inlineCopy["1_0_1_GB_1024_0b59a8b9"]
        : inlineCopy["1_means_unlimited_0_disables_96118a1b"]}</Typography.Text>
      <Alert type="info" showIcon message={zh ? inlineCopy["1_P2P_f392112e"]
        : inlineCopy["Resets_on_the_first_of_7f256eee"]} />
    </Space>
  </Modal>;
}
