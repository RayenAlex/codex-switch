import { useEffect, useRef, useState } from 'react';
import { AUTO_UNLOCK_ERRORS, DEFAULT_DESKTOP_SECURITY, type DesktopSecurity, type DesktopSecurityChange } from './security';
import type { DesktopDisplaySession } from './displaySession';

export function useDesktopSecurity(receiver: { current?: DesktopDisplaySession }, active: boolean) {
  const [value, setValue] = useState(DEFAULT_DESKTOP_SECURITY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const polling = useRef<Promise<void>>();
  const [clipboardSync, setClipboardSync] = useState(true);
  useEffect(() => { if (!active) setError(''); }, [active]);
  const update = async (change: DesktopSecurityChange) => {
    const current = receiver.current;
    if (!current || pending.current) return;
    pending.current = true; setSaving(true); setError('');
    try {
      await polling.current;
      if (receiver.current !== current) return;
      const state = await current.security(change);
      if (receiver.current === current) setValue(state);
    } catch (cause) {
      const message = typeof cause === 'string' ? cause : cause instanceof Error ? cause.message : '';
      if (receiver.current === current) setError(AUTO_UNLOCK_ERRORS.find(item => item === message)
        ?? '安全选项未能保存，请重试。');
    } finally { pending.current = false; setSaving(false); }
  };
  useEffect(() => {
    if (!active || value.autoUnlock?.status !== 'unlocking') return;
    let disposed = false;
    const timer = setInterval(() => {
      const current = receiver.current;
      if (!current || pending.current || polling.current) return;
      polling.current = current.security({}).then(state => {
        if (!disposed && receiver.current === current) setValue(state);
      }).catch(() => {
        if (!disposed && receiver.current === current) setError('自动解锁状态未能更新，请重新连接后查看。');
      }).finally(() => { polling.current = undefined; });
    }, 1500);
    return () => { disposed = true; clearInterval(timer); };
  }, [active, value.autoUnlock?.status, receiver]);
  const receive = (state?: DesktopSecurity) => setValue(state ?? DEFAULT_DESKTOP_SECURITY);
  return { value, saving, error, update, receive, clipboardSync,
    toggleClipboardSync: () => setClipboardSync(current => !current) };
}
