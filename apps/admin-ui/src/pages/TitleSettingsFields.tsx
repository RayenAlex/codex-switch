import EFFORT_LABELSResource from '@remoteai/i18n/copy/admin/titleEffortLabels';
import inlineCopy from '@remoteai/i18n/copy/inline/admin/pages/TitleSettingsFields';
import { Card, Form, Input, Select, Typography } from 'antd';
import { TITLE_MODEL_PATTERN, TITLE_REASONING_EFFORTS } from '../../../../shared/chat/titleSettings';

const EFFORT_LABELS = EFFORT_LABELSResource;

export function TitleSettingsFields({ zh, loading }: { zh: boolean; loading: boolean }) {
  return <Card loading={loading} className="chat-policy-section">
    <div className="chat-policy-section-heading">
      <Typography.Title level={4}>{zh ? inlineCopy["text_77563a27"] : inlineCopy["Automatic_conversation_titles_82c9346d"]}</Typography.Title>
      <Typography.Text type="secondary">{zh
        ? inlineCopy["Codex_GUI_GUI_2965ce47"]
        : inlineCopy["Create_short_titles_for_new_1a2cee52"]}
      </Typography.Text>
    </div>
    <Form.Item name={['titleSettings', 'model']} label={zh ? inlineCopy["text_7472b8d9"] : inlineCopy["Title_model_2e36d341"]}
      rules={[{ required: true, pattern: TITLE_MODEL_PATTERN,
        message: zh ? inlineCopy["text_ec13ed23"] : inlineCopy["Enter_a_valid_model_name_5c0749d5"] }]}>
      <Input maxLength={128} placeholder="gpt-5.6-luna" />
    </Form.Item>
    <Form.Item name={['titleSettings', 'effort']} label={zh ? inlineCopy["text_c8c14507"] : inlineCopy["Reasoning_effort_3236aeec"]}
      rules={[{ required: true }]}>
      <Select options={TITLE_REASONING_EFFORTS.map((value, index) => ({ value,
        label: zh ? EFFORT_LABELS[index] : value }))} />
    </Form.Item>
  </Card>;
}
