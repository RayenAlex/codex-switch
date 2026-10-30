import { useEffect, useState } from 'react';
import { Typography } from 'antd';
import { translateMessage } from '../../../../shared/localization/messages';
import { useI18n } from '../i18n-context';
import type { LoungeAdminApi } from './LoungeUserModal';

const REFRESH_MS = 5000;

export function LoungePresence({ api }: { api: LoungeAdminApi }) {
  const { language } = useI18n();
  const [count, setCount] = useState<number>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    let busy = false;
    const abort = new AbortController();
    const refresh = async () => {
      if (busy) return;
      busy = true;
      try {
        const value = await api<{ onlineCount: number }>('/admin/api/lounge/presence', { signal: abort.signal });
        if (!Number.isSafeInteger(value.onlineCount) || value.onlineCount < 0) throw new Error('Invalid count');
        if (active) { setCount(value.onlineCount); setFailed(false); }
      } catch { if (active) { setFailed(true); setCount(undefined); } }
      finally { busy = false; }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), REFRESH_MS);
    return () => { active = false; clearInterval(timer); abort.abort(); };
  }, [api]);
  const text = count === undefined ? translateMessage(language,
    failed ? 'client.lounge.onlineUnavailable' : 'client.lounge.onlineLoading')
    : translateMessage(language, 'client.lounge.adminOnlineCount', { count });
  return <Typography.Paragraph type="secondary" role="status" style={{ maxWidth: 400 }}>{text}</Typography.Paragraph>;
}
