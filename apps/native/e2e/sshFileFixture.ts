import { Buffer } from 'buffer';
import type { SshApi, SshEntry, SshFileAction, SshFileReply } from '../../../shared/terminal/ssh';

type Upload = { path: string; size: number; bytes: Buffer };

/** Retain actual bytes so device tests verify editing and saving, rather than only UI state. */
export function createSshFileFixture(): SshApi['files'] {
  const content = new Map<string, Buffer>([
    ['/hello.txt', Buffer.from('hello')],
    ['/app.ts', Buffer.from('const message = "中文代码";\r\n')],
    ['/中文目录/nested.txt', Buffer.from('nested content')],
    ['/.hidden', Buffer.from('hidden')],
  ]);
  const entries: SshEntry[] = [
    { name: '中文目录', path: '/中文目录', directory: true, size: 0 },
    ...[...content].map(([path, data]) => ({ path, name: path.split('/').at(-1)!,
      directory: false, size: data.length })),
  ];
  const uploads = new Map<string, Upload>();
  const finish = (token: string): SshFileReply => {
    const upload = uploads.get(token);
    if (!upload) throw new Error('client.ssh.fileFailed');
    content.set(upload.path, upload.bytes);
    const entry = entries.find(item => item.path === upload.path);
    if (entry) entry.size = upload.size;
    else entries.push({ path: upload.path, name: upload.path.split('/').at(-1)!, size: upload.size, directory: false });
    uploads.delete(token);
    return { type: 'uploaded', path: upload.path };
  };
  const transfer = (action: SshFileAction): SshFileReply | undefined => {
    if (action.type === 'uploadStart') {
      if (content.has(action.path) && action.mode === 'reject') throw new Error('client.ssh.conflict');
      const token = String(uploads.size + 1);
      uploads.set(token, { path: action.path, size: action.size, bytes: Buffer.alloc(action.size) });
      return { type: 'upload', token };
    }
    if (action.type === 'uploadChunk') {
      const upload = uploads.get(action.token);
      if (!upload) throw new Error('client.ssh.fileFailed');
      Buffer.from(action.data, 'base64').copy(upload.bytes, action.offset);
      return { type: 'done' };
    }
    if (action.type === 'uploadFinish') return finish(action.token);
    if (action.type === 'uploadCancel') { uploads.delete(action.token); return { type: 'done' }; }
    return undefined;
  };
  return async (_id, action) => transfer(action) ?? fileAction({ action, entries, content });
}

function fileAction({ action, entries, content }: {
  action: SshFileAction; entries: SshEntry[]; content: Map<string, Buffer>;
}): SshFileReply {
  if (!('path' in action)) return { type: 'done' };
  const path = action.path === '.' ? '/' : action.path;
  if (action.type === 'list') return { type: 'list', path, truncated: false,
    entries: entries.filter(entry => entry.path.slice(0, entry.path.lastIndexOf('/')) === path.replace(/\/$/, '')) };
  if (action.type === 'read') return { type: 'file', data: (content.get(path) ?? Buffer.alloc(0)).toString('base64') };
  if (action.type === 'readChunk') return { type: 'file', data: (content.get(path) ?? Buffer.alloc(0))
    .slice(action.offset, action.offset + action.length).toString('base64') };
  if (action.type === 'createFolder' || action.type === 'createFile') {
    entries.push({ path, name: path.split('/').at(-1)!, directory: action.type === 'createFolder', size: 0 });
  }
  if (action.type === 'rename') {
    const entry = entries.find(item => item.path === path);
    if (entry) { entry.path = action.destination; entry.name = action.destination.split('/').at(-1)!; }
    const bytes = content.get(path);
    if (bytes) { content.set(action.destination, bytes); content.delete(path); }
  }
  if (action.type === 'delete' || action.type === 'deleteTree') {
    for (let index = entries.length - 1; index >= 0; index--) {
      if (entries[index]!.path === path || entries[index]!.path.startsWith(`${path}/`)) {
        content.delete(entries[index]!.path); entries.splice(index, 1);
      }
    }
  }
  return { type: 'done' };
}
