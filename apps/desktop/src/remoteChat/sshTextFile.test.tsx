// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { SSH_FILE_LIMIT, type SshApi, type SshEntry, type SshFileReply } from '../../../../shared/terminal/ssh';
import { decodeSshText, sshTextUpload } from '../../../../shared/terminal/sshTextFile';
import { useSshFileEditor } from '../../../../shared/terminal/useSshFileEditor';

const entry: SshEntry = { name: 'script', path: '/home/script', directory: false, size: 20 };
const base64 = (text: string) => Buffer.from(text).toString('base64');
afterEach(() => vi.unstubAllGlobals());

it.each(['', '#!/bin/sh\necho 中文 😀\n', '\uFEFFconst x = 1;\r\n', 'one\rtwo\r'])
('round-trips UTF-8 text, BOMs and source line endings: %j', async source => {
  const content = decodeSshText(base64(source));
  expect(content).toBeDefined();
  const upload = sshTextUpload('script', content!);
  expect(Buffer.from(await upload.read(0, upload.size), 'base64').toString()).toBe(source);
});

it('preserves the source BOM and CRLF when a text input supplies new LF lines', async () => {
  const content = decodeSshText(base64('\uFEFFfirst\r\nsecond\r\n'))!;
  expect(content.text).toBe('first\nsecond\n');
  const upload = sshTextUpload('script', { ...content, text: 'changed\nsecond\n' });
  expect(Buffer.from(await upload.read(0, upload.size), 'base64').toString())
    .toBe('\uFEFFchanged\r\nsecond\r\n');
});

it.each([[0, 65], [0x89, 0x50, 0x4e, 0x47], [0xc0, 0xaf], [0xed, 0xa0, 0x80], [0x1b, 91, 65]]
  .map(bytes => ({ bytes })))
('does not expose binary or invalid UTF-8 bytes as editable text: $bytes', ({ bytes }) => {
  expect(decodeSshText(Buffer.from(bytes).toString('base64'))).toBeUndefined();
});

it('decodes and encodes large text without treating the plain-text threshold as an editing limit', () => {
  expect(decodeSshText(Buffer.alloc(SSH_FILE_LIMIT + 1, 65).toString('base64'))?.text.length)
    .toBe(SSH_FILE_LIMIT + 1);
  expect(sshTextUpload('script', { text: '中'.repeat(SSH_FILE_LIMIT / 2), bom: false, newline: '\n' }).size)
    .toBeGreaterThan(SSH_FILE_LIMIT);
});

async function fixture(source = 'original') {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  let data = Buffer.from(source);
  let chunks: Buffer[] = [];
  const download = vi.fn(async () => {});
  const onSaved = vi.fn(async () => {});
  const api: SshApi = { profiles: { list: vi.fn(), save: vi.fn(), remove: vi.fn() }, probe: vi.fn(), open: vi.fn(),
    files: vi.fn(async (_id, request): Promise<SshFileReply> => {
      if (request.type === 'read') return { type: 'file', data: data.toString('base64') };
      if (request.type === 'uploadStart') {
        if (request.mode === 'reject') throw new Error('client.ssh.conflict');
        chunks = []; return { type: 'upload', token: 'save' };
      }
      if (request.type === 'uploadChunk') chunks.push(Buffer.from(request.data, 'base64'));
      if (request.type === 'uploadFinish') { data = Buffer.concat(chunks); return { type: 'uploaded', path: entry.path }; }
      return { type: 'done' };
    }) };
  let state!: ReturnType<typeof useSshFileEditor>;
  const root = createRoot(document.createElement('div'));
  function Fixture({ id }: { id: string }) { state = useSshFileEditor({ api, id, download, onSaved }); return null; }
  const render = (id: string) => act(async () => root.render(<Fixture id={id} />));
  await render('session');
  return { api, download, onSaved, render, state: () => state, content: () => data.toString(),
    stop: () => act(async () => root.unmount()) };
}

it('opens extensionless Unicode scripts and atomically saves the draft to the original path', async () => {
  const f = await fixture('\uFEFForiginal\r\n');
  try {
    await act(async () => expect(await f.state().open(entry)).toBe('opened'));
    await act(async () => f.state().changeText('你好\nnew line\n'));
    expect(f.state().dirty).toBe(true);
    await act(async () => expect(await f.state().save()).toBe(true));
    expect(f.content()).toBe('\uFEFF你好\r\nnew line\r\n');
    expect(f.api.files).toHaveBeenCalledWith('session', {
      type: 'uploadStart', path: entry.path, size: Buffer.byteLength(f.content()), mode: 'overwrite',
    });
    expect(f.state().dirty).toBe(false); expect(f.state().busy).toBe(false);
    expect(f.onSaved).toHaveBeenCalledOnce(); expect(f.download).not.toHaveBeenCalled();
    await act(async () => f.state().close());
    expect(f.state().document).toBeUndefined();
  } finally { await f.stop(); }
});

it('allows empty saved files and does not replace drafts when another row is activated', async () => {
  const f = await fixture();
  try {
    await act(async () => f.state().open(entry));
    await act(async () => f.state().changeText(''));
    await act(async () => expect(await f.state().open({ ...entry, path: '/another' })).toBeUndefined());
    expect(f.state().document?.entry.path).toBe(entry.path);
    await act(async () => expect(await f.state().save()).toBe(true));
    expect(f.content()).toBe(''); expect(f.state().dirty).toBe(false);
  } finally { await f.stop(); }
});

it('downloads binary files without opening the editor or changing any bytes', async () => {
  const f = await fixture('binary\0bytes');
  try {
    await act(async () => expect(await f.state().open(entry)).toBe('downloaded'));
    expect(f.state().document).toBeUndefined();
    expect(f.download).toHaveBeenCalledExactlyOnceWith(entry, base64('binary\0bytes'));
  } finally { await f.stop(); }
});

it('retains unsaved changes and cancels the temporary upload when saving fails', async () => {
  const f = await fixture();
  try {
    await act(async () => f.state().open(entry));
    await act(async () => f.state().changeText('keep this draft'));
    const send = vi.mocked(f.api.files).getMockImplementation()!;
    vi.mocked(f.api.files).mockImplementation(async (id, request) => {
      if (request.type === 'uploadChunk') throw new Error('client.ssh.closed');
      return send(id, request);
    });
    await act(async () => expect(await f.state().save()).toBe(false));
    expect(f.state().document?.text).toBe('keep this draft'); expect(f.state().dirty).toBe(true);
    expect(f.state().error).toBe('client.ssh.closed'); expect(f.content()).toBe('original');
    expect(f.api.files).toHaveBeenLastCalledWith('session', { type: 'uploadCancel', token: 'save' });
  } finally { await f.stop(); }
});

it('ignores duplicate clicks and late reads from a previous connection', async () => {
  const f = await fixture();
  let resolve!: (reply: SshFileReply) => void;
  const reply = new Promise<SshFileReply>(done => { resolve = done; });
  vi.mocked(f.api.files).mockReturnValueOnce(reply);
  let pending!: Promise<unknown>;
  try {
    await act(async () => { pending = f.state().open(entry); });
    await act(async () => expect(await f.state().open(entry)).toBeUndefined());
    expect(f.api.files).toHaveBeenCalledOnce();
    await f.render('other-session');
    await act(async () => { resolve({ type: 'file', data: base64('late response') }); await pending; });
    expect(f.state().document).toBeUndefined(); expect(f.state().busy).toBe(false);
  } finally { resolve({ type: 'done' }); await pending; await f.stop(); }
});

it('stops retrying when the destination remains in conflict after accepting overwrite', async () => {
  const f = await fixture();
  try {
    await act(async () => f.state().open(entry));
    await act(async () => f.state().changeText('keep this draft'));
    vi.mocked(f.api.files).mockRejectedValue(new Error('client.ssh.conflict'));
    await act(async () => expect(await f.state().save()).toBe(false));
    expect(f.api.files).toHaveBeenCalledTimes(3);
    expect(f.state().dirty).toBe(true); expect(f.state().error).toBe('client.ssh.fileFailed');
  } finally { await f.stop(); }
});

it('reports a completed save even when refreshing the directory afterward fails', async () => {
  const f = await fixture();
  try {
    await act(async () => f.state().open(entry));
    await act(async () => f.state().changeText('saved'));
    f.onSaved.mockRejectedValue(new Error('client.ssh.closed'));
    await act(async () => expect(await f.state().save()).toBe(true));
    expect(f.content()).toBe('saved'); expect(f.state().dirty).toBe(false);
    expect(f.state().error).toBe('client.ssh.closed');
  } finally { await f.stop(); }
});
