// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { useSshConnection } from '../../../../shared/terminal/useSshConnection';
import type { SshApi } from '../../../../shared/terminal/ssh';
import type { SshProfile } from '../../../../shared/terminal/sshProfiles';
import type { TerminalInfo } from '../../../../shared/terminal/types';

afterEach(() => vi.unstubAllGlobals());
const values = { name: 'Server', host: 'test', port: 22, username: 'user', auth: 'password' as const, password: 'secret' };
const info: TerminalInfo = { id: 'ssh-1', cwd: '', projectCwd: '/project', shell: 'SSH' };

async function fixture(initial?: SshProfile) {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  let profiles = initial ? [initial] : [];
  const api: SshApi = { profiles: { list: vi.fn(async (): Promise<SshProfile[]> => profiles),
    save: vi.fn(async value => { profiles = [{ ...value, revision: (value.revision ?? 0) + 1 }]; return profiles; }),
    remove: vi.fn(async () => []) },
  probe: vi.fn(async () => 'SHA256:first'), open: vi.fn(async () => info), files: vi.fn(),
  ensureX11: vi.fn(async () => {}) };
  const connected = vi.fn(); const dispose = vi.fn(async () => {}); const close = vi.fn();
  const root = createRoot(document.createElement('div'));
  let state!: ReturnType<typeof useSshConnection>;
  function Fixture() {
    state = useSshConnection({ api, initial, projectCwd: '/project', createId: () => 'saved', connected, dispose, close });
    return null;
  }
  await act(async () => root.render(<Fixture />));
  return { api, connected, dispose, close, state: () => state, stop: () => act(async () => root.unmount()) };
}

it('requires host confirmation, saves metadata and credentials separately, and adopts the shell once', async () => {
  const f = await fixture();
  try {
    await act(async () => f.state().submit(values));
    expect(f.state().trust?.fingerprint).toBe('SHA256:first');
    expect(f.api.open).not.toHaveBeenCalled();
    await act(async () => Promise.all([f.state().submit(values), f.state().submit(values)]));
    expect(f.api.open).toHaveBeenCalledTimes(1);
    expect(f.api.profiles.save).toHaveBeenCalledWith({ id: 'saved', name: 'Server', host: 'test', port: 22,
      username: 'user', auth: 'password', fingerprint: 'SHA256:first' }, { password: 'secret' });
    expect(f.connected).toHaveBeenCalledWith(info);
    expect(f.close).toHaveBeenCalledOnce();
  } finally { await f.stop(); }
});

const keyProfile: SshProfile = { id: 'key', name: 'Server', host: 'test', port: 22, username: 'user',
  auth: 'key', fingerprint: 'SHA256:first', revision: 3, accountScope: 'account' };

it('updates a changed fingerprint from the editor and resumes its connection test without losing edits', async () => {
  const f = await fixture({ ...keyProfile, auth: 'password', fingerprint: 'SHA256:old' });
  try {
    await act(async () => f.state().test({ ...values, name: 'Edited name' }));
    expect(f.state().trust?.previousFingerprints).toEqual(['SHA256:old']);
    await act(async () => f.state().clearTrust());
    await act(async () => f.state().confirmTrust());
    expect(f.api.profiles.save).not.toHaveBeenCalled(); expect(f.api.open).not.toHaveBeenCalled();
    await act(async () => f.state().test({ ...values, name: 'Edited name' }));
    await act(async () => f.state().confirmTrust());
    expect(f.state().tested).toBe(true); expect(f.close).not.toHaveBeenCalled();
    expect(f.state().selected?.revision).toBe(4);
    expect(f.api.profiles.save).toHaveBeenCalledExactlyOnceWith({ ...keyProfile, auth: 'password' });
    await act(async () => f.state().saveSettings({ ...values, name: 'Edited name' }));
    expect(f.api.profiles.save).toHaveBeenLastCalledWith({ ...keyProfile, auth: 'password',
      name: 'Edited name', revision: 4 }, { password: 'secret' });
    expect(f.state().error).toBe('');
  } finally { await f.stop(); }
});

it('saves a name edit without credentials or a connection and preserves all other saved fields', async () => {
  const f = await fixture(keyProfile);
  try {
    vi.mocked(f.api.probe).mockRejectedValue(new Error('offline'));
    await act(async () => f.state().saveSettings({ ...keyProfile, name: 'Renamed' }));
    expect(f.api.profiles.save).toHaveBeenCalledExactlyOnceWith({ ...keyProfile, name: 'Renamed' });
    expect(f.api.probe).not.toHaveBeenCalled(); expect(f.api.open).not.toHaveBeenCalled();
    expect(f.connected).not.toHaveBeenCalled(); expect(f.close).toHaveBeenCalledOnce();
  } finally { await f.stop(); }
});

it.each([{ host: 'new.test' }, { port: 2222 }])('forgets the old fingerprint when saving a changed endpoint %j',
  async edit => {
    const f = await fixture(keyProfile);
    try {
      await act(async () => f.state().saveSettings({ ...keyProfile, ...edit }));
      expect(f.api.profiles.save).toHaveBeenCalledWith({ ...keyProfile, ...edit, fingerprint: undefined });
      expect(f.api.probe).not.toHaveBeenCalled();
    } finally { await f.stop(); }
  });

it('does not write an unchanged profile', async () => {
  const f = await fixture(keyProfile);
  try {
    await act(async () => f.state().saveSettings(keyProfile));
    expect(f.api.profiles.save).not.toHaveBeenCalled(); expect(f.close).toHaveBeenCalledOnce();
  } finally { await f.stop(); }
});

it('saves a new key profile without testing or including credentials', async () => {
  const f = await fixture();
  try {
    await act(async () => f.state().saveSettings({ ...values, auth: 'key' }));
    expect(f.api.profiles.save).toHaveBeenCalledWith({ id: 'saved', name: 'Server', host: 'test', port: 22,
      username: 'user', auth: 'key', fingerprint: undefined });
    expect(f.api.open).not.toHaveBeenCalled(); expect(f.api.probe).not.toHaveBeenCalled();
  } finally { await f.stop(); }
});

it('tests authentication once, closes the test session and keeps the form open without saving', async () => {
  const f = await fixture();
  try {
    await act(async () => f.state().test(values));
    expect(f.state().trust?.fingerprint).toBe('SHA256:first'); expect(f.api.open).not.toHaveBeenCalled();
    await act(async () => Promise.all([f.state().test(values), f.state().test(values)]));
    expect(f.api.open).toHaveBeenCalledExactlyOnceWith({ endpoint: { host: 'test', port: 22 }, username: 'user',
      fingerprint: 'SHA256:first', size: { cols: 80, rows: 24 }, password: 'secret' }, '/project');
    expect(f.dispose).toHaveBeenCalledExactlyOnceWith(info.id); expect(f.state().tested).toBe(true);
    expect(f.api.profiles.save).not.toHaveBeenCalled(); expect(f.connected).not.toHaveBeenCalled();
    expect(f.close).not.toHaveBeenCalled(); expect(f.state().finished).toBe(false);
    await act(async () => f.state().saveSettings(values));
    expect(f.api.profiles.save).toHaveBeenCalledWith(expect.objectContaining({ fingerprint: 'SHA256:first' }),
      { password: 'secret' });
  } finally { await f.stop(); }
});

it('keeps failed tests separate from saving and clears obsolete success feedback', async () => {
  const f = await fixture({ ...keyProfile, auth: 'password' });
  try {
    await act(async () => f.state().test(values));
    await act(async () => f.state().clearTest());
    expect(f.state().tested).toBe(false);
    vi.mocked(f.api.open).mockRejectedValue(new Error('client.ssh.authenticationFailed'));
    await act(async () => f.state().test(values));
    expect(f.state().error).toBe('client.ssh.authenticationFailed'); expect(f.state().tested).toBe(false);
    await act(async () => f.state().saveSettings({ ...values, name: 'Renamed' }));
    expect(f.api.profiles.save).toHaveBeenCalledOnce(); expect(f.close).toHaveBeenCalledOnce();
  } finally { await f.stop(); }
});

it('leaves edits available after a save conflict without attempting SSH authentication', async () => {
  const f = await fixture(keyProfile);
  try {
    vi.mocked(f.api.profiles.save).mockRejectedValue(new Error('client.ssh.profileChanged'));
    await act(async () => f.state().saveSettings({ ...keyProfile, name: 'Renamed' }));
    expect(f.state().error).toBe('client.ssh.profileChanged'); expect(f.state().finished).toBe(false);
    expect(f.close).not.toHaveBeenCalled(); expect(f.api.open).not.toHaveBeenCalled();
  } finally { await f.stop(); }
});

it('closes a late test session after the form is unmounted', async () => {
  const f = await fixture();
  await act(async () => f.state().test(values));
  let resolve!: (info: TerminalInfo) => void;
  vi.mocked(f.api.open).mockImplementation(() => new Promise(done => { resolve = done; }));
  let pending!: Promise<void>;
  await act(async () => { pending = f.state().test(values); });
  await f.stop();
  await act(async () => { resolve(info); await pending; });
  expect(f.dispose).toHaveBeenCalledWith(info.id); expect(f.connected).not.toHaveBeenCalled();
  expect(f.api.profiles.save).not.toHaveBeenCalled();
});

it('prompts for a freshly pulled changed fingerprint before sending credentials', async () => {
  const f = await fixture();
  try {
    await act(async () => f.state().submit(values));
    vi.mocked(f.api.profiles.list).mockResolvedValue([{ ...values, id: 'pc', fingerprint: 'SHA256:other' }]);
    await act(async () => f.state().submit(values));
    expect(f.state().trust).toMatchObject({ fingerprint: 'SHA256:first', previousFingerprints: ['SHA256:other'] });
    expect(f.api.open).not.toHaveBeenCalled();
  } finally { await f.stop(); }
});

it('reports failed persistence while retaining the connected shell', async () => {
  const f = await fixture();
  try {
    await act(async () => f.state().submit(values));
    vi.mocked(f.api.profiles.save).mockRejectedValue(new Error('offline'));
    await act(async () => f.state().submit(values));
    expect(f.state().error).toBe('client.ssh.storageFailed');
    expect(f.connected).toHaveBeenCalledWith(info);
    expect(f.close).not.toHaveBeenCalled();
  } finally { await f.stop(); }
});

it('closes a late connection after leaving the form instead of adopting it in another project', async () => {
  const f = await fixture();
  await act(async () => f.state().submit(values));
  let resolve!: (info: TerminalInfo) => void;
  vi.mocked(f.api.open).mockImplementation(() => new Promise(done => { resolve = done; }));
  let pending!: Promise<void>;
  await act(async () => { pending = f.state().submit(values); });
  await f.stop();
  await act(async () => { resolve(info); await pending; });
  expect(f.dispose).toHaveBeenCalledWith(info.id);
  expect(f.connected).not.toHaveBeenCalled();
  expect(f.api.profiles.save).not.toHaveBeenCalled();
});

it('prepares X11 once before saving, without testing credentials or opening a terminal', async () => {
  const f = await fixture();
  try {
    let ready!: () => void;
    vi.mocked(f.api.ensureX11!).mockImplementation(() => new Promise(resolve => { ready = resolve; }));
    const options = { ...values, x11: { display: ':1' } };
    let pending!: Promise<void>;
    await act(async () => { pending = f.state().saveSettings(options); });
    expect(f.state().preparingX11).toBe(true); expect(f.state().busy).toBe(true);
    await act(async () => f.state().saveSettings(options));
    expect(f.api.ensureX11).toHaveBeenCalledExactlyOnceWith(options.x11);
    expect(f.api.profiles.save).not.toHaveBeenCalled(); expect(f.close).not.toHaveBeenCalled();
    await act(async () => { ready(); await pending; });
    expect(f.api.profiles.save).toHaveBeenCalledOnce(); expect(f.close).toHaveBeenCalledOnce();
    expect(f.api.open).not.toHaveBeenCalled(); expect(f.api.probe).not.toHaveBeenCalled();
    expect(f.state().preparingX11).toBe(false);
  } finally { await f.stop(); }
});

it('keeps the form retryable when X11 startup fails and skips startup when forwarding is disabled', async () => {
  const f = await fixture();
  try {
    vi.mocked(f.api.ensureX11!).mockRejectedValueOnce(new Error('client.ssh.x11StartFailed'));
    await act(async () => f.state().saveSettings({ ...values, x11: {} }));
    expect(f.state().error).toBe('client.ssh.x11StartFailed'); expect(f.state().busy).toBe(false);
    expect(f.api.profiles.save).not.toHaveBeenCalled(); expect(f.close).not.toHaveBeenCalled();
    await act(async () => f.state().saveSettings(values));
    expect(f.api.ensureX11).toHaveBeenCalledOnce(); expect(f.api.profiles.save).toHaveBeenCalledOnce();
  } finally { await f.stop(); }
});

it('does not save after leaving the form while X11 is starting', async () => {
  const f = await fixture();
  let ready!: () => void;
  vi.mocked(f.api.ensureX11!).mockImplementation(() => new Promise(resolve => { ready = resolve; }));
  let pending!: Promise<void>;
  await act(async () => { pending = f.state().saveSettings({ ...values, x11: {} }); });
  await f.stop();
  await act(async () => { ready(); await pending; });
  expect(f.api.profiles.save).not.toHaveBeenCalled(); expect(f.close).not.toHaveBeenCalled();
});
