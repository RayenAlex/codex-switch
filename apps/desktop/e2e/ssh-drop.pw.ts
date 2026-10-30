import { expect, test, type Locator, type Page } from '@playwright/test';
import type { SshFileAction, SshFileReply } from '../../../shared/terminal/ssh';
import type { SshProfile } from '../../../shared/terminal/sshProfiles';

async function fixture(page: Page, mode: string) {
  const stored = new Map<string, Buffer>();
  const uploads = new Map<string, { path: string; bytes: Buffer[] }>();
  let profiles: SshProfile[] = [];
  await page.route('http://127.0.0.1:1499/sync/ssh-profiles**', async route => {
    if (route.request().method() === 'PUT') profiles = [{ ...route.request().postDataJSON(), revision: 1 }];
    await route.fulfill({ json: profiles });
  });
  await page.route('http://127.0.0.1:1498/rpc', async route => {
    const { request } = route.request().postDataJSON() as { request: SshFileAction };
    let data: SshFileReply = { type: 'done' };
    if (request.type === 'list') data = { type: 'list', path: '/', truncated: false,
      entries: [...stored].map(([path, bytes]) => ({ path, name: path.slice(1), size: bytes.length, directory: false })) };
    if (request.type === 'uploadStart') {
      if (stored.has(request.path) && request.mode === 'reject') {
        await route.fulfill({ json: { error: 'client.ssh.conflict' } }); return;
      }
      const token = crypto.randomUUID(); uploads.set(token, { path: request.path, bytes: [] });
      data = { type: 'upload', token };
    }
    if (request.type === 'uploadChunk') uploads.get(request.token)!.bytes.push(Buffer.from(request.data, 'base64'));
    if (request.type === 'uploadFinish') {
      const upload = uploads.get(request.token)!;
      stored.set(upload.path, Buffer.concat(upload.bytes)); uploads.delete(request.token);
      data = { type: 'uploaded', path: upload.path };
    }
    await route.fulfill({ json: { data } });
  });
  await page.goto(`/e2e/ssh-harness.html?mode=${mode}&cloud=1`);
  await page.getByRole('button', { name: mode === 'web' ? '打开远程终端' : '打开终端', exact: true }).click();
  await page.getByRole('button', { name: '终端连接选项' }).click();
  await page.getByRole('menuitem', { name: '新建 SSH 连接…' }).click();
  await page.getByLabel('IP 或主机名').fill('upload.test');
  await page.getByLabel('用户名', { exact: true }).fill('tester');
  await page.getByLabel('密码', { exact: true }).fill('fixture-only');
  await page.getByRole('button', { name: '连接并保存', exact: true }).click();
  await page.getByRole('button', { name: '信任并连接', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('[role="tabpanel"]:visible .xterm')).toBeVisible();
  return stored;
}

async function drop(page: Page, target: Locator, files: { name: string; content: string }[]) {
  const transfer = await page.evaluateHandle(files => {
    const data = new DataTransfer();
    for (const file of files) data.items.add(new File([file.content], file.name));
    return data;
  }, files);
  await target.dispatchEvent('dragover', { dataTransfer: transfer });
  await expect(page.getByRole('status').filter({ hasText: '松开以上传到' })).toBeVisible();
  await target.dispatchEvent('drop', { dataTransfer: transfer });
  await transfer.dispose();
}

for (const mode of ['local', 'remote', 'web']) {
  test(`${mode}: drag into shell opens uploads; file browser accepts batches and confirms conflicts`, async ({ page }, info) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const stored = await fixture(page, mode);
    await drop(page, page.locator('[role="tabpanel"]:visible .xterm'), [{ name: '中文.txt', content: '你好' }]);
    await expect(page.getByRole('tree')).toContainText('中文.txt');
    expect(stored.get('/中文.txt')?.toString()).toBe('你好');
    await drop(page, page.locator('.ssh-project-browser'), [
      { name: 'second.txt', content: 'second' }, { name: 'empty.txt', content: '' },
    ]);
    await expect(page.getByRole('tree')).toContainText('empty.txt');
    expect(stored.get('/second.txt')?.toString()).toBe('second');
    expect(stored.get('/empty.txt')?.length).toBe(0);
    await drop(page, page.locator('.ssh-project-browser'), [{ name: '中文.txt', content: 'replacement' }]);
    await expect(page.getByRole('dialog', { name: '已存在同名文件' })).toBeVisible();
    expect(stored.get('/中文.txt')?.toString()).toBe('你好');
    await page.getByRole('button', { name: /^覆\s*盖$/ }).click();
    await expect.poll(() => stored.get('/中文.txt')?.toString()).toBe('replacement');
    await expect(page.locator('.ssh-project-browser')).toHaveAttribute('aria-busy', 'false');
    await page.screenshot({ path: info.outputPath(`ssh-drop-${mode}.png`), animations: 'disabled' });
    expect(await page.locator('.ssh-project-browser').evaluate(element => element.scrollWidth <= element.clientWidth))
      .toBe(true);
  });
}
