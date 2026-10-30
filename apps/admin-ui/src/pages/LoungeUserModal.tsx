import { useEffect, useState } from 'react';
import { Alert, Button, InputNumber, Modal, Space, Spin, Switch, Typography } from 'antd';
import { translateMessage } from '../../../../shared/localization/messages';
import type { MessageKey } from '@remoteai/i18n';
import { MAX_MUTE_MINUTES, type LoungePolicy } from '../../../../shared/lounge/types';
import { useI18n } from '../i18n-context';
import type { UserRow } from '../types';

export type LoungeAdminApi = <T>(path: string, options?: RequestInit) => Promise<T>;

export function LoungeUserModal({ user, api, close, self }: {
  user: UserRow; api: LoungeAdminApi; close: () => void; self: boolean;
}) {
  const { language } = useI18n();
  const text = (key: MessageKey) => translateMessage(language, key);
  const [policy, setPolicy] = useState<LoungePolicy>();
  const [minutes, setMinutes] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const path = `/admin/api/lounge/users/${encodeURIComponent(user.id)}`;
  useEffect(() => {
    let active = true;
    void api<LoungePolicy>(path).then(value => { if (active) setPolicy(value); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [api, path]);
  const save = async (unmute = false) => {
    if (!policy || saving) return;
    setSaving(true); setFailed(false);
    try {
      await api(path, { method: 'PATCH', body: JSON.stringify({ moderator: policy.moderator,
        ...(unmute ? { minutes: 0 } : minutes !== null ? { minutes } : {}) }) });
      close();
    } catch { setFailed(true); }
    finally { setSaving(false); }
  };
  const valid = minutes === null || Number.isInteger(minutes) && minutes >= 1 && minutes <= MAX_MUTE_MINUTES;
  return <Modal open width={400} title={text('client.lounge.adminSettings')} onCancel={close}
    closable={!saving} maskClosable={!saving} keyboard={!saving} footer={<>
      <Button disabled={saving} onClick={close}>{text('client.lounge.cancel')}</Button>
      {!self && <Button disabled={!policy || saving} onClick={() => void save(true)}>
        {text('client.lounge.unmute')}</Button>}
      <Button type="primary" disabled={!policy || !valid} loading={saving} onClick={() => void save()}>
        {text('client.lounge.save')}</Button>
    </>}>
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Typography.Text style={{ overflowWrap: 'anywhere' }}>{user.email}</Typography.Text>
      {!policy && !failed && <Spin />}
      {policy && <>
        <label style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          {text('client.lounge.moderator')}
          <Switch checked={policy.moderator} disabled={saving} aria-label={text('client.lounge.moderator')}
            onChange={moderator => setPolicy({ ...policy, moderator })} />
        </label>
        <Typography.Text type="secondary">{text('client.lounge.moderatorHint')}</Typography.Text>
        {!self && <>
          <label>{text('client.lounge.duration')}
            <InputNumber min={1} max={MAX_MUTE_MINUTES} precision={0} value={minutes} onChange={setMinutes}
              aria-label={text('client.lounge.duration')} disabled={saving} style={{ width: '100%' }} />
          </label>
          <Typography.Text type="secondary">{text('client.lounge.adminDurationHint')}</Typography.Text>
          {policy.mutedUntil && Date.parse(policy.mutedUntil) > Date.now() && <Typography.Text>
            {translateMessage(language, 'client.lounge.mutedUntil', {
              time: new Intl.DateTimeFormat(language, { dateStyle: 'short', timeStyle: 'short' })
                .format(new Date(policy.mutedUntil)),
            })}</Typography.Text>}
        </>}
      </>}
      {failed && <Alert type="error" message={text('client.lounge.actionFailed')} />}
    </Space>
  </Modal>;
}
