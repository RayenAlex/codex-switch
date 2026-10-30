import { useCallback, useEffect, useRef, useState } from 'react';
import { quotaDisplayApi, type QuotaDisplayStatus } from '../api/quotaDisplay';

const REFRESH_MS = 2_500;
const CHANGE_EVENT = 'quota-display-preference-changed';

export function useQuotaDisplay() {
  const [status, setStatus] = useState<QuotaDisplayStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const mounted = useRef(false);
  const reading = useRef(false);
  const writing = useRef(false);
  const revision = useRef(0);

  const refresh = useCallback(async () => {
    if (reading.current || writing.current) return;
    const current = revision.current;
    reading.current = true;
    try {
      const next = await quotaDisplayApi.load();
      if (mounted.current && current === revision.current) { setStatus(next); setError(false); }
    } catch {
      if (mounted.current && current === revision.current) setError(true);
    } finally { reading.current = false; }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const onChange = () => { revision.current += 1; void refresh(); };
    void refresh();
    const timer = window.setInterval(() => void refresh(), REFRESH_MS);
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
      window.removeEventListener(CHANGE_EVENT, onChange);
    };
  }, [refresh]);

  const update = useCallback(async (enabled: boolean) => {
    if (writing.current) return;
    writing.current = true;
    revision.current += 1;
    setSaving(true);
    let saved = false;
    try {
      const settings = await quotaDisplayApi.save(enabled);
      saved = true;
      if (mounted.current) {
        setStatus({ enabled: settings.quotaDisplayAllAccounts ?? false, average: null });
        setError(false);
      }
      window.dispatchEvent(new Event(CHANGE_EVENT));
    } catch {
      if (mounted.current) setError(true);
    } finally {
      writing.current = false;
      if (mounted.current) { setSaving(false); if (saved) void refresh(); }
    }
  }, [refresh]);

  return { status, saving, error, update, refresh, supported: quotaDisplayApi.supported };
}
