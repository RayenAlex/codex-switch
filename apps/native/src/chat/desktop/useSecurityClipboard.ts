import { useEffect, useRef, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import type { sessionClipboard } from '../../../../../shared/remote-desktop/sessionClipboard';

/** Native clipboard access is tied to a tap, including the iOS paste permission prompt. */
export function useSecurityClipboard(clipboard: Pick<ReturnType<typeof sessionClipboard>, 'read' | 'write'>,
  active: boolean) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const pending = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    setStatus('');
    return () => { generation.current += 1; };
  }, [active]);
  const run = async (copy: boolean) => {
    if (!active || pending.current) return;
    pending.current = true; setBusy(true); setStatus('');
    const started = generation.current;
    try {
      if (copy) {
        const content = await clipboard.read();
        if (generation.current !== started) return;
        if (!content || content.format !== 'text') throw new Error('请先在远程电脑上复制文字。');
        const copied = await Clipboard.setStringAsync(content.text).catch(() => false);
        if (!copied) throw new Error('无法访问剪贴板，请重试。');
      } else {
        const text = await Clipboard.getStringAsync().catch(() => { throw new Error('无法访问剪贴板，请重试。'); });
        if (generation.current !== started) return;
        if (!text) throw new Error('请先在本机复制文字。');
        await clipboard.write({ format: 'text', text }, true);
      }
      if (generation.current === started) setStatus(copy ? '已复制到本机。' : '已粘贴到远程电脑。');
    } catch (error) {
      if (generation.current === started) setStatus(error instanceof Error ? error.message : '剪贴板传输失败，请重试。');
    } finally { pending.current = false; setBusy(false); }
  };
  return { busy, status, copy: () => { void run(true); }, paste: () => { void run(false); } };
}
