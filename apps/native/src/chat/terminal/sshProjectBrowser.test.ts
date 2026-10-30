import { expect, it, vi } from 'vitest';
import { setStringAsync } from 'expo-clipboard';
import { nativeSshProjectBrowser } from './sshProjectBrowser';
import { nativeSshDownload } from './sshTransfers';
import { createSshFileFixture } from '../../../e2e/sshFileFixture';
import { isNativeSshBrowserAction } from '../../../../../shared/terminal/nativeSshBrowserAction';
import type { SshApi } from '../../../../../shared/terminal/ssh';

vi.mock('expo-clipboard', () => ({ setStringAsync: vi.fn(async () => true) }));
vi.mock('./sshTransfers', () => ({ nativeSshDownload: vi.fn(async () => {}) }));

function api(): SshApi {
  return { profiles: {} as SshApi['profiles'], probe: vi.fn(), open: vi.fn(), files: createSshFileFixture() };
}

it('keeps the browser identity for draft restoration, isolated by connection and terminal', () => {
  const connection = api();
  const browser = nativeSshProjectBrowser(connection, 'one');
  expect(nativeSshProjectBrowser(connection, 'one').client).toBe(browser.client);
  expect(nativeSshProjectBrowser(connection, 'two').client).not.toBe(browser.client);
  expect(nativeSshProjectBrowser(api(), 'one').client).not.toBe(browser.client);
});

it('uses the shared editor and delegates downloads and copied paths to native services', async () => {
  const { client, host } = nativeSshProjectBrowser(api(), 'one');
  const target = { cwd: '/', path: '/hello.txt' };
  const document = await client.read(target);
  expect(document).toMatchObject({ kind: 'text', text: 'hello', readOnly: false });
  await client.save({ ...target, text: '手机修改\n', revision: document.revision });
  expect(await client.read(target)).toMatchObject({ text: '手机修改\n' });
  await host.download!(target);
  expect(nativeSshDownload).toHaveBeenCalledWith(expect.objectContaining({ path: target.path }),
    Buffer.from('手机修改\n').toString('base64'));
  await host.copyPath('/中文目录');
  expect(setStringAsync).toHaveBeenCalledWith('/中文目录');
  expect(host.entryActions).not.toContain('copy');
  expect(host.downloadDirectory).toBe(false);
  expect(host.reference).toBeUndefined();
});

it('accepts only supported navigation, picker and visibility messages from the WebView', () => {
  for (const action of [{ action: 'navigate', path: '/中文目录' }, { action: 'upload' },
    { action: 'hidden', value: false }]) expect(isNativeSshBrowserAction({ type: 'ssh', ...action })).toBe(true);
  for (const action of [null, {}, { type: 'request', action: 'upload' },
    { type: 'ssh', action: 'hidden', value: 'false' }, { type: 'ssh', action: 'delete' },
    ...['', ' ', '/x\0', 'a'.repeat(4097)].map(path => ({ type: 'ssh', action: 'navigate', path }))]) {
    expect(isNativeSshBrowserAction(action)).toBe(false);
  }
});
