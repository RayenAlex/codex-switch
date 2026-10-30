// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import type { SshApi, SshFileAction, SshFileReply } from '../../../../shared/terminal/ssh';
import { useSshFiles } from '../../../../shared/terminal/useSshFiles';
import { reportSshDirectory } from '../../../../shared/terminal/sshDirectory';

afterEach(() => vi.unstubAllGlobals());

async function fixture(id: string) {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const requests: SshFileAction[] = [];
  const api: SshApi = { profiles: { list: vi.fn(), save: vi.fn(), remove: vi.fn() }, probe: vi.fn(), open: vi.fn(),
    files: vi.fn(async (_id, request): Promise<SshFileReply> => {
      requests.push(request);
      if (request.type === 'list') return { type: 'list', path: request.path === '.' ? '/home' : request.path,
        entries: [], truncated: false };
      if (request.type === 'uploadStart') return { type: 'upload', token: request.path };
      if (request.type === 'uploadFinish') return { type: 'uploaded', path: request.token };
      return { type: 'done' };
    }) };
  const root = createRoot(document.createElement('div'));
  let state!: ReturnType<typeof useSshFiles>;
  function Fixture() { state = useSshFiles(api, id); return null; }
  await act(async () => root.render(<Fixture />));
  return { api, requests, state: () => state, stop: () => act(async () => root.unmount()) };
}

it('opens at the last actual shell directory and follows subsequent directory changes', async () => {
  reportSshDirectory('files-follow', '/home/work');
  const f = await fixture('files-follow');
  try {
    expect(f.state().loaded).toBe(true); expect(f.state().path).toBe('/home/work');
    await act(async () => reportSshDirectory('files-follow', '/tmp/中文'));
    expect(f.state().path).toBe('/tmp/中文');
  } finally { await f.stop(); }
});

it('pins an entire upload batch to its initial directory and follows cwd after it finishes', async () => {
  const f = await fixture('files-batch');
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const file = (name: string) => ({ name, size: 1, read: async () => { await gate; return 'eA=='; } });
  let pending!: Promise<boolean>;
  try {
    await act(async () => { pending = f.state().uploadMany([file('one'), file('two')]); });
    await act(async () => reportSshDirectory('files-batch', '/new'));
    expect(f.state().path).toBe('/home');
    await act(async () => { release(); await pending; });
    expect(f.requests.filter(request => request.type === 'uploadStart').map(request => request.path))
      .toEqual(['/home/one', '/home/two']);
    expect(f.state().path).toBe('/new'); expect(f.state().busy).toBe(false);
  } finally { release(); await pending; await f.stop(); }
});

it('cancelling a batch stops later files and reports arbitrary failures through the display boundary', async () => {
  const f = await fixture('files-cancel');
  try {
    await act(async () => f.state().uploadMany([
      { name: 'one', size: 1, read: async () => { f.state().cancelUpload(); return 'eA=='; } },
      { name: 'two', size: 0, read: async () => '' },
    ]));
    expect(f.requests.filter(request => request.type === 'uploadStart')).toHaveLength(1);
    expect(f.requests.some(request => request.type === 'uploadCancel')).toBe(true);
    expect(f.state().error).toBe('');
    await act(async () => f.state().reportError(new Error('client.ssh.invalidName')));
    expect(f.state().error).toBe('client.ssh.invalidName');
  } finally { await f.stop(); }
});
