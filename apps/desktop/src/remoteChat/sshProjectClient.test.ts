import { expect, it, vi } from 'vitest';
import { createSshProjectClient } from '../../../../shared/terminal/sshProjectClient';
import { searchSshProject } from '../../../../shared/terminal/sshProjectSearch';
import type { SshApi, SshFileReply } from '../../../../shared/terminal/ssh';
import { PROJECT_PLAIN_TEXT_THRESHOLD } from '../../../../shared/project-browser/protocol';

function fixture(name = 'code.ts') {
  let data = Buffer.from('\ufeffconst text = "中文";\r\n');
  const chunks: Buffer[] = [];
  const files = vi.fn<SshApi['files']>(async (_id, request): Promise<SshFileReply> => {
    switch (request.type) {
      case 'list': return { type: 'list', path: '/', truncated: false,
        entries: [{ name, path: `/${name}`, directory: false, size: data.length }] };
      case 'read': return { type: 'file', data: data.toString('base64') };
      case 'readChunk': return { type: 'file', data: data.subarray(request.offset,
        request.offset + request.length).toString('base64') };
      case 'uploadStart':
        if (request.mode === 'reject') throw new Error('client.ssh.conflict');
        chunks.length = 0; return { type: 'upload', token: 'upload' };
      case 'uploadChunk': chunks.push(Buffer.from(request.data, 'base64')); return { type: 'done' };
      case 'uploadFinish': data = Buffer.concat(chunks); return { type: 'uploaded', path: '/code.ts' };
      default: return { type: 'done' };
    }
  });
  const api: SshApi = { files, profiles: {} as SshApi['profiles'], probe: vi.fn(), open: vi.fn() };
  return { ...createSshProjectClient(api, 'session'), files, content: () => data,
    replace: (value: Buffer) => { data = value; } };
}

it('preserves BOM and CRLF while saving and refuses to overwrite a changed remote file', async () => {
  const state = fixture();
  const target = { cwd: '/', path: '/code.ts' };
  const original = await state.client.read(target);
  expect(original.text).toBe('const text = "中文";\n');
  const saved = await state.client.save({ ...target, revision: original.revision, text: 'new\nlines\n' });
  expect(state.content().toString()).toBe('\ufeffnew\r\nlines\r\n');
  expect(saved.text).toBe('new\nlines\n');
  expect(saved.revision).not.toBe(original.revision);
  state.replace(Buffer.from('external change'));
  state.files.mockClear();
  await expect(state.client.save({ ...target, revision: saved.revision, text: 'my draft' }))
    .rejects.toThrow('client.projectBrowser.thisFileChangedElsewhereCopyYourEditsBeforeReloadingIt');
  expect(state.files.mock.calls.every(([, request]) => ['list', 'readChunk'].includes(request.type))).toBe(true);
  expect(state.content().toString()).toBe('external change');
});

it('marks binary files read-only and reads large text in bounded chunks', async () => {
  const state = fixture();
  state.replace(Buffer.from([0, 255, 12]));
  expect(await state.client.read({ cwd: '/', path: '/code.ts' })).toMatchObject({ kind: 'binary', readOnly: true });
  state.replace(Buffer.alloc(PROJECT_PLAIN_TEXT_THRESHOLD + 1, 'x'));
  state.files.mockClear();
  expect(await state.client.read({ cwd: '/', path: '/code.ts' })).toMatchObject({ kind: 'text', readOnly: false });
  expect(state.files.mock.calls.filter(([, request]) => request.type === 'readChunk').length).toBeGreaterThan(1);
});

it('skips image contents beyond the shared preview threshold', async () => {
  const state = fixture('photo.png');
  state.replace(Buffer.alloc(PROJECT_PLAIN_TEXT_THRESHOLD + 1));
  expect(await state.client.read({ cwd: '/', path: '/photo.png' })).toMatchObject({ kind: 'large', readOnly: true });
  expect(state.files).toHaveBeenCalledTimes(1);
  expect(state.files).toHaveBeenLastCalledWith('session', { type: 'list', path: '/' });
});

it('maps rename and move to SSH operations and leaves unsupported copy untouched', async () => {
  const state = fixture();
  await expect(state.client.mutate({ cwd: '/', path: '/code.ts', action: 'rename', name: 'next.ts' }))
    .resolves.toEqual({ path: '/next.ts', directory: false });
  expect(state.files).toHaveBeenLastCalledWith('session', {
    type: 'rename', path: '/code.ts', destination: '/next.ts',
  });
  await state.client.mutate({ cwd: '/', path: '/code.ts', action: 'move', directory: '/folder' });
  expect(state.files).toHaveBeenLastCalledWith('session', {
    type: 'rename', path: '/code.ts', destination: '/folder/code.ts',
  });
  await expect(state.client.mutate({ cwd: '/', path: '/code.ts', action: 'copy', directory: '/' })).rejects.toThrow();
});

it.each([PROJECT_PLAIN_TEXT_THRESHOLD, PROJECT_PLAIN_TEXT_THRESHOLD + 1])('saves a %i-byte draft in chunks', async size => {
  const state = fixture();
  const target = { cwd: '/', path: '/code.ts' };
  const original = await state.client.read(target);
  state.files.mockClear();
  const saved = await state.client.save({ ...target, revision: original.revision, text: 'x'.repeat(size) });
  expect(saved.kind).toBe('text');
  expect(saved.text?.length).toBe(size);
  expect(state.content().toString()).toBe('\ufeff' + 'x'.repeat(size));
});

it('searches unopened directories, tolerates unreadable children and bounds alias cycles', async () => {
  const list = vi.fn(async (path: string) => {
    if (path === '/denied') throw new Error('permission denied');
    if (path === '/alias') return { path: '/', entries: [], truncated: false };
    return { path, truncated: false, entries: path === '/' ? ['src', 'denied', 'alias'].map(name => ({
      name, path: `/${name}`, directory: true, size: 0,
    })) : [{ name: 'Code.ts', path: '/src/Code.ts', directory: false, size: 2 }] };
  });
  const result = await searchSshProject({ list, root: '/', query: 'src/code' });
  expect(result.entries).toMatchObject([{ path: '/src/Code.ts', relativePath: 'src/Code.ts' }]);
  expect(result.truncated).toBe(true);
  expect(list).toHaveBeenCalledTimes(4);
});
