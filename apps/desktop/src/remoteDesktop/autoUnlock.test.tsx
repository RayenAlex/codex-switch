// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { validateDesktopSecurity, type DesktopSecurity, type SecuritySettingsProps }
  from '../../../../shared/remote-desktop/security';
import { useAutoUnlockForm } from '../../../../shared/remote-desktop/useAutoUnlockForm';
import { useDesktopSecurity } from '../../../../shared/remote-desktop/useDesktopSecurity';
import type { DesktopDisplaySession } from '../../../../shared/remote-desktop/displaySession';

let root: Root;
let form: ReturnType<typeof useAutoUnlockForm>;
let security: ReturnType<typeof useDesktopSecurity>;
const update = vi.fn(async () => {});
const base: Pick<SecuritySettingsProps, 'value' | 'update' | 'connected' | 'control'> = {
  value: { lockOnDisconnect: false, muteHost: false, autoUnlock: { enabled: false, status: 'disabled' } },
  update, connected: true, control: true,
};
const receive = vi.fn<(change: object) => Promise<DesktopSecurity>>();
const receiver = { current: { security: receive } as unknown as DesktopDisplaySession };
function Form(props: typeof base) { form = useAutoUnlockForm(props); return null; }
function Security({ active = true }) { security = useDesktopSecurity(receiver, active); return null; }
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.clearAllMocks(); root = createRoot(document.createElement('div'));
});
afterEach(async () => { await act(async () => root.unmount()); vi.useRealTimers(); });

it('rejects malformed credentials without echoing the rejected value', () => {
  for (const autoUnlock of [true, {}, { enabled: true }, { enabled: true, username: 'alice', password: 'x\0' },
    { enabled: true, username: 'alice', password: 'x'.repeat(257) },
    { enabled: false, password: 'sensitive-value' }, { enabled: true, username: ' alice', password: 'p' }]) {
    expect(() => validateDesktopSecurity({ autoUnlock })).toThrow('安全选项无效，请重试。');
  }
  expect(validateDesktopSecurity({ autoUnlock: { enabled: true, username: 'PC\\alice', password: ' p ' } }))
    .toEqual({ autoUnlock: { enabled: true, username: 'PC\\alice', password: ' p ' } });
});

it('clears credentials on save, cancel, and lost control without persisting them', async () => {
  await act(async () => root.render(<Form {...base} />));
  await act(async () => { form.edit(); form.setUsername(' PC\\alice '); form.setPassword('fixture-password'); });
  await act(async () => form.save());
  expect(update).toHaveBeenCalledWith({ autoUnlock: { enabled: true, username: 'PC\\alice', password: 'fixture-password' } });
  expect(form.password).toBe(''); expect(form.username).toBe(''); expect(form.editing).toBe(false);
  await act(async () => { form.edit(); form.setPassword('unsaved'); });
  await act(async () => form.cancel()); expect(form.password).toBe('');
  await act(async () => { form.edit(); form.setPassword('unsaved'); });
  await act(async () => root.render(<Form {...base} control={false} />));
  expect(form.editing).toBe(false); expect(form.password).toBe('');
  expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0);
});

it('waits for an in-flight status poll before saving, with no overlapping calls or lost edits', async () => {
  vi.useFakeTimers();
  await act(async () => root.render(<Security />));
  await act(async () => security.receive({ ...base.value, autoUnlock: { enabled: true, status: 'unlocking' } }));
  let finish!: (value: DesktopSecurity) => void;
  receive.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await act(async () => vi.advanceTimersByTimeAsync(1500));
  expect(receive).toHaveBeenCalledTimes(1);
  let saved!: Promise<void>;
  await act(async () => { saved = security.update({ autoUnlock: { enabled: false } }); });
  await act(async () => vi.advanceTimersByTimeAsync(4500));
  expect(receive).toHaveBeenCalledTimes(1);
  receive.mockResolvedValueOnce(base.value);
  await act(async () => { finish({ ...base.value, autoUnlock: { enabled: true, status: 'ready' } }); await saved; });
  expect(receive).toHaveBeenNthCalledWith(2, { autoUnlock: { enabled: false } });
  expect(security.value).toEqual(base.value);
  await act(async () => vi.advanceTimersByTimeAsync(3000));
  expect(receive).toHaveBeenCalledTimes(2);
});

it('shows only allowlisted credential errors', async () => {
  await act(async () => root.render(<Security />));
  receive.mockRejectedValueOnce('请使用这台电脑已绑定的 Windows 账号。');
  await act(async () => security.update({ autoUnlock: { enabled: false } }));
  expect(security.error).toBe('请使用这台电脑已绑定的 Windows 账号。');
  receive.mockRejectedValueOnce(new Error('sensitive internal detail'));
  await act(async () => security.update({ autoUnlock: { enabled: false } }));
  expect(security.error).toBe('安全选项未能保存，请重试。');
});
