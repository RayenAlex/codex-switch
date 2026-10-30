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
const update = vi.fn(async () => true);
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
  vi.clearAllMocks(); update.mockResolvedValue(true); root = createRoot(document.createElement('div'));
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

it.each(['alice', 'PC\\alice'])(
  'saves %s and clears credentials on save, cancel, and lost control without persisting them', async username => {
  await act(async () => root.render(<Form {...base} />));
  await act(async () => { form.edit(); form.setUsername(` ${username} `); form.setPassword('fixture-password'); });
  await act(async () => form.save());
  const change = { autoUnlock: { enabled: true, username, password: 'fixture-password' } };
  expect(update).toHaveBeenCalledWith(change);
  expect(validateDesktopSecurity(change)).toEqual(change);
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
  let saved!: Promise<boolean>;
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

it('keeps the form open and clears the password until the host confirms saving', async () => {
  await act(async () => root.render(<Form {...base} />));
  await act(async () => { form.toggle(); form.setUsername('PC\\alice'); form.setPassword('fixture-password'); });
  let finish!: (saved: boolean) => void;
  update.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  let saving!: Promise<void>;
  await act(async () => { saving = form.save(); });
  expect(form.editing).toBe(true); expect(form.password).toBe('');
  await act(async () => { finish(false); await saving; });
  expect(form.editing).toBe(true); expect(form.username).toBe('PC\\alice');
  await act(async () => form.setPassword('corrected-password'));
  await act(async () => form.save());
  expect(form.editing).toBe(false); expect(form.password).toBe('');
});

it('reports a host that silently ignores an enable request instead of claiming success', async () => {
  await act(async () => root.render(<Security />));
  receive.mockResolvedValueOnce(base.value);
  await act(async () => {
    expect(await security.update({ autoUnlock: { enabled: true, username: 'PC\\alice', password: 'fixture' } }))
      .toBe(false);
  });
  expect(security.saved).toBe(false);
  expect(security.error).toBe('安全选项未能保存，请重试。');
});

it('loads host settings on a new connection and saves clipboard preferences remotely', async () => {
  await act(async () => root.render(<Security />));
  const saved: DesktopSecurity = { lockOnDisconnect: true, muteHost: true, clipboardSync: false,
    autoUnlock: { enabled: true, status: 'ready' } };
  await act(async () => security.receive(saved));
  expect(security.clipboardSync).toBe(false); expect(security.value.autoUnlock?.enabled).toBe(true);
  receive.mockResolvedValueOnce({ ...saved, clipboardSync: true });
  await act(async () => security.toggleClipboardSync());
  expect(receive).toHaveBeenCalledWith({ clipboardSync: true }); expect(security.clipboardSync).toBe(true);
  await act(async () => security.receive());
  await act(async () => security.receive(saved));
  expect(security.value).toEqual(saved); expect(security.clipboardSync).toBe(false);
});
