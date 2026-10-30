import inlineCopy from '@remoteai/i18n/copy/inline/admin/pages/UpdateSharingPage';
import { Button, Card, Form, Select, Space, Switch, Typography } from 'antd';
import { useI18n } from '../i18n-context';
import { useUpdateSharingSettings, type UpdateSharingSettingsProps } from '../hooks/useUpdateSharingSettings';
import { UpdateDownloadStatistics } from './UpdateDownloadStatistics';

const UPLOAD_SPEEDS = [0, 64, 128, 256, 512, 1024, 2048, 4096, 8192];

export function UpdateSharingPage({ api, canManage }: UpdateSharingSettingsProps) {
  const { language, t } = useI18n();
  const zh = language === 'zh';
  const settings = useUpdateSharingSettings(api, zh);
  const disabled = !canManage || settings.loading || settings.saving || !settings.loaded;
  return <Space direction="vertical" size="large" style={{ width: '100%' }}>
    <div>
      <Typography.Title level={2}>{t('nav.updateSharing')}</Typography.Title>
      <Typography.Paragraph type="secondary">{zh
        ? inlineCopy["text_61ce84e8"]
        : inlineCopy.descriptionEn}</Typography.Paragraph>
    </div>
    <UpdateDownloadStatistics api={api} />
    <Card title={zh ? inlineCopy["text_ed23a6c4"] : inlineCopy["Installer_sharing_3b199b16"]} loading={settings.loading}>
      <Form form={settings.form} layout="vertical" onFinish={settings.save} disabled={disabled}
        style={{ maxWidth: 560 }}>
        <Form.Item name="scope" label={zh ? inlineCopy["text_d1b2bf59"] : inlineCopy["Sharing_scope_9fbf08fd"]} rules={[{ required: true }]}>
          <Select options={[
            { value: 'off', label: zh ? inlineCopy["text_3fd47edc"] : inlineCopy["Off_ca7981b4"] },
            { value: 'own', label: zh ? inlineCopy["text_0542b7f6"] : inlineCopy["My_devices_6f3cba5e"] },
            { value: 'everyone', label: zh ? inlineCopy["text_099aaa20"] : inlineCopy["All_users_f7898130"] },
          ]} />
        </Form.Item>
        <Form.Item name="uploadKibPerSecond" label={zh ? inlineCopy["text_3ad11137"] : inlineCopy["Upload_speed_limit_a54cef37"]}
          rules={[{ required: true }]}>
          <Select options={UPLOAD_SPEEDS.map(value => ({ value,
            label: value === 0 ? (zh ? inlineCopy["text_e264d2c9"] : inlineCopy["Unlimited_11dde17d"]) : `${value} KiB/s` }))} />
        </Form.Item>
        <Form.Item name="unmeteredOnly" valuePropName="checked"
          label={zh ? inlineCopy["text_3abe2fda"] : inlineCopy["Upload_only_on_unmetered_networks_be97e2ac"]}>
          <Switch />
        </Form.Item>
        <Form.Item name="prepareAndroid" valuePropName="checked"
          label={zh ? inlineCopy["Android_b034f554"] : inlineCopy["Prepare_Android_installers_in_advance_4b5ec658"]}>
          <Switch />
        </Form.Item>
        <Typography.Paragraph type="secondary">{zh
          ? inlineCopy["Android_d0975a54"]
          : inlineCopy["Online_computers_download_Android_installers_0d857a02"]}
        </Typography.Paragraph>
        <Typography.Paragraph type="secondary">{zh
          ? inlineCopy["30_a6f71a23"]
          : inlineCopy["Online_computers_usually_apply_saved_7c55572b"]}</Typography.Paragraph>
        <Space wrap>
          {canManage && <Button type="primary" htmlType="submit" loading={settings.saving}>{t('common.save')}</Button>}
          <Button onClick={settings.reload} disabled={settings.loading || settings.saving}>
            {zh ? inlineCopy["text_7bdd5ce1"] : inlineCopy["Reload_bdc090ec"]}</Button>
        </Space>
      </Form>
    </Card>
  </Space>;
}
