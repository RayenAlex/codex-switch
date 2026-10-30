// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { invoke, type Channel } from '@tauri-apps/api/core';
import { sshApi, attachSsh } from './sshApi';
import { readSshProfiles, saveSshProfiles } from '../../../../../../shared/terminal/sshProfiles';
import type { TerminalEvent } from '../../../../../../shared/terminal/types';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(), Channel: class { onmessage = () => {}; } }));
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); localStorage.clear(); });

it('prepares the X server on the local SSH host without opening a connection', async () => {
  await sshApi.ensureX11!({ display: ':2' });
  expect(invoke).toHaveBeenCalledExactlyOnceWith('codex_gui_ssh_ensure_x11', { options: { display: ':2' } });
});

it('persists only connection metadata, never passwords or private keys', () => {
  const profile = { id: 'a', name: 'test', host: 'test', port: 22, username: 'user', auth: 'key' as const,
    password: 'secret', privateKey: 'PRIVATE KEY', passphrase: 'other-secret' };
  saveSshProfiles([profile]);
  expect(readSshProfiles()).toEqual([{ id: 'a', name: 'test', host: 'test', port: 22, username: 'user', auth: 'key' }]);
  expect(localStorage.getItem('remoteai.ssh.profiles.v1')).not.toContain('secret');
  expect(localStorage.getItem('remoteai.ssh.profiles.v1')).not.toContain('PRIVATE KEY');
});

it('replays early output and allows immediate effect reattachment before closing the abandoned session', async () => {
  vi.useFakeTimers();
  const output: TerminalEvent = { type: 'output', data: [65] };
  vi.mocked(invoke).mockImplementation(async (command, raw) => {
    if (command !== 'codex_gui_ssh_open') return undefined;
    (raw as { onEvent: Channel<TerminalEvent> }).onEvent.onmessage(output);
    return { id: 'ssh-fixture', shell: 'SSH', cwd: '' };
  });
  const info = await sshApi.open({ endpoint: { host: 'test', port: 22 }, username: 'user', fingerprint: 'SHA256:key',
    password: 'secret', size: { cols: 80, rows: 24 } }, '/project');
  const first = vi.fn(); const second = vi.fn();
  const attachment = await attachSsh(info, first);
  expect(first).toHaveBeenCalledWith(output);
  attachment.detach();
  const reattached = await attachSsh(info, second);
  await vi.runAllTimersAsync();
  expect(invoke).toHaveBeenCalledTimes(1);
  expect(second).toHaveBeenCalledWith(output);
  reattached.detach(); await vi.runAllTimersAsync();
  expect(invoke).toHaveBeenLastCalledWith('codex_gui_ssh_command', { request: { type: 'close', id: info.id } });
});
