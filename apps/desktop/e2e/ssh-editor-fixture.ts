import type { Page } from '@playwright/test';
import type { SshFileAction, SshFileReply } from '../../../shared/terminal/ssh';
import type { SshProfile } from '../../../shared/terminal/sshProfiles';

const profile: SshProfile = { id: 'editor', name: 'Editor server', host: 'editor.test', port: 22,
  username: 'user', auth: 'password', fingerprint: 'SHA256:fixture', revision: 1 };

export async function sshEditorFixture(page: Page) {
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
  const files = new Map<string, Buffer | null>([
    ['/中文目录', null], ['/hello.txt', Buffer.from('Hello 中文\n')],
    ['/中文目录/nested.txt', Buffer.from('Nested file\n')], ['/.hidden', Buffer.from('hidden\n')],
    ['/script.ts', Buffer.from('\ufeffconst greeting = "你好";\r\n')], ['/image.bin', Buffer.from([0, 255, 123, 22])],
  ]);
  const uploads = new Map<string, { path: string; parts: Buffer[] }>();
  let rejectSave = false;
  let sequence = 0;
  const reply = (request: SshFileAction): SshFileReply => {
    switch (request.type) {
      case 'list': {
        const path = request.path === '.' ? '/' : request.path;
        const prefix = path === '/' ? '/' : `${path}/`;
        const entries = [...files]
          .filter(([name]) => name.startsWith(prefix) && !name.slice(prefix.length).includes('/'))
          .map(([name, bytes]) => ({ path: name, name: name.slice(prefix.length), directory: bytes === null,
            size: bytes?.length ?? 0 }));
        return { type: 'list', path, entries, truncated: false };
      }
      case 'read': return { type: 'file', data: files.get(request.path)!.toString('base64') };
      case 'readChunk': return { type: 'file',
        data: files.get(request.path)!.subarray(request.offset, request.offset + request.length).toString('base64') };
      case 'uploadStart': {
        if (files.has(request.path) && request.mode === 'reject') throw new Error('client.ssh.conflict');
        const token = String(++sequence); uploads.set(token, { path: request.path, parts: [] });
        return { type: 'upload', token };
      }
      case 'uploadChunk': uploads.get(request.token)!.parts.push(Buffer.from(request.data, 'base64')); break;
      case 'uploadCancel': uploads.delete(request.token); break;
      case 'uploadFinish': {
        if (rejectSave) { rejectSave = false; throw new Error('client.ssh.fileFailed'); }
        const upload = uploads.get(request.token)!;
        files.set(upload.path, Buffer.concat(upload.parts)); uploads.delete(request.token);
        return { type: 'uploaded', path: upload.path };
      }
      case 'createFile': case 'createFolder':
        if (files.has(request.path)) throw new Error('client.ssh.conflict');
        files.set(request.path, request.type === 'createFolder' ? null : Buffer.alloc(0)); break;
      case 'rename':
        if (files.has(request.destination)) throw new Error('client.ssh.conflict');
        for (const [path, value] of [...files]) {
          if (path === request.path || path.startsWith(`${request.path}/`)) {
            files.set(request.destination + path.slice(request.path.length), value); files.delete(path);
          }
        }
        break;
      case 'delete': case 'deleteTree':
        for (const path of files.keys()) {
          if (path === request.path || path.startsWith(`${request.path}/`)) files.delete(path);
        }
        break;
      default: throw new Error(`Unsupported fixture action ${request.type}`);
    }
    return { type: 'done' };
  };
  await page.route('http://127.0.0.1:1499/sync/ssh-profiles**', route => route.fulfill({
    json: route.request().url().endsWith('/credentials') ? { credentials: { password: 'fixture' } } : [profile],
  }));
  await page.route('http://127.0.0.1:1498/rpc', async route => {
    try { await route.fulfill({ json: { data: reply(route.request().postDataJSON().request as SshFileAction) } }); }
    catch (error) { await route.fulfill({ json: { error: (error as Error).message } }); }
  });
  return { files, failNextSave: () => { rejectSave = true; } };
}
