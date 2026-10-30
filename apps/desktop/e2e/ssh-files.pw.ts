import { expect, test, type Page, type TestInfo } from '@playwright/test';
import type { SshProfile } from '../../../shared/terminal/sshProfiles';

test.skip(!process.env.SSH_FILES_FIXTURE, 'Requires the isolated Rust SSH bridge on port 1508');
const bridge = 'http://127.0.0.1:1508';
const confirm = (page: Page) => page.locator('[role="dialog"], [role="alertdialog"]')
  .getByRole('button', { name: /^确\s*定$/ });
const entry = (page: Page, name: string) => page.locator('.ssh-file-list button, .pf-tree-row').filter({ hasText: name });
const browser = (page: Page) => page.locator('.ssh-files, .ssh-project-browser');
const filename = (page: Page) => page.getByRole('textbox', { name: /^(文件名|名称)$/ });
const sharedBrowser = (page: Page) => page.locator('.ssh-project-browser').count();

async function backToTree(page: Page) {
  const back = page.getByRole('button', { name: '返回文件列表', exact: true });
  if (await back.isVisible()) await back.click();
}

async function createSharedWorkspace(page: Page, name: string) {
  const create = async (label: string, value: string) => {
    await page.getByRole('button', { name: '项目文件夹操作', exact: true }).click();
    await page.getByRole('menuitem', { name: '新建', exact: true }).hover();
    await page.getByRole('menuitem', { name: label, exact: true }).click();
    await filename(page).fill(value); await confirm(page).click();
  };
  await create('新建文件夹', name);
  await expect(entry(page, name)).toBeVisible();
  const path = page.getByRole('textbox', { name: '远程路径' });
  await path.fill(`/${name}`); await path.press('Enter');
  await expect(path).toHaveValue(`/${name}`);
  await create('新建文件', 'note.txt');
  await backToTree(page);
}

async function connect(page: Page, mode: string) {
  const fixture = await (await page.request.get(`${bridge}/config`)).json();
  let profiles: SshProfile[] = [];
  await page.route('http://127.0.0.1:1499/sync/ssh-profiles**', async route => {
    if (route.request().method() === 'PUT') profiles = [{ ...route.request().postDataJSON(), revision: 1 }];
    await route.fulfill({ json: profiles });
  });
  await page.goto(`/e2e/ssh-harness.html?mode=${mode}&bridge=1508`);
  await page.getByRole('button', { name: mode === 'web' ? '打开远程终端' : '打开终端', exact: true }).click();
  await page.getByRole('button', { name: '终端连接选项' }).click();
  await page.getByRole('menuitem', { name: '新建 SSH 连接…' }).click();
  await page.getByLabel('IP 或主机名').fill(fixture.host);
  await page.getByLabel('端口').fill(String(fixture.port));
  await page.getByLabel('用户名', { exact: true }).fill(fixture.username);
  await page.getByLabel('密码', { exact: true }).fill(fixture.password);
  await page.getByRole('button', { name: '连接并保存', exact: true }).click();
  await page.getByRole('button', { name: '信任并连接', exact: true }).click();
  await page.getByRole('button', { name: '远程文件浏览', exact: true }).click();
  await expect(entry(page, 'hello.txt')).toBeVisible();
}

async function contextAction(page: Page, name: string, action: string) {
  await entry(page, name).click({ button: 'right' });
  await page.getByRole('menuitem', { name: action, exact: true }).click();
}

async function createWorkspace(page: Page, name: string) {
  if (await sharedBrowser(page)) { await createSharedWorkspace(page, name); return; }
  const { path, home, parent } = await page.locator('.ssh-file-controls').evaluate(controls => {
    const buttons = controls.querySelectorAll('.ssh-file-navigation button');
    const box = (element: Element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    };
    return { path: box(controls.querySelector('.ssh-file-path')!), home: box(buttons[0]), parent: box(buttons[1]) };
  });
  expect(home!.x + home!.width).toBeLessThanOrEqual(parent!.x);
  expect(Math.abs(home!.y - parent!.y)).toBeLessThan(3);
  expect(home!.y + home!.height).toBeLessThan(path!.y);
  await contextAction(page, 'hello.txt', '新建文件夹');
  await page.getByLabel('文件名').fill(name); await confirm(page).click();
  await entry(page, name).click();
  await expect(page.getByRole('textbox', { name: '远程路径' })).toHaveValue(`/${name}`);
  await page.locator('.ssh-file-list').click({ button: 'right', position: { x: 15, y: 60 } });
  await page.getByRole('menuitem', { name: '新建文件', exact: true }).click();
  await page.getByLabel('文件名').fill('note.txt'); await confirm(page).click();
  await expect(entry(page, 'note.txt')).toBeVisible();
}

async function upload(page: Page, name: string, content: Buffer) {
  await browser(page).locator('input[type="file"]').setInputFiles({ name, mimeType: 'application/octet-stream',
    buffer: content });
}

async function assertDownload(page: Page, name: string, expected: string) {
  await contextAction(page, name, '下载');
  await expect(page.getByRole('status').filter({ hasText: '已加入下载管理' })).toBeVisible();
  const back = page.getByRole('button', { name: '返回终端', exact: true });
  if (await back.isVisible()) await back.click();
  await page.getByRole('button', { name: '下载管理', exact: true }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('article').filter({ has: page.getByText(name, { exact: true }) })
    .getByRole('button', { name: '保存到设备', exact: true }).click();
  const buffers: Buffer[] = [];
  for await (const chunk of (await (await downloaded).createReadStream())!) buffers.push(Buffer.from(chunk));
  expect(Buffer.concat(buffers).toString()).toBe(expected);
  await page.getByRole('button', { name: '返回 SSH', exact: true }).click();
  await page.getByRole('button', { name: '远程文件浏览', exact: true }).click();
}

async function checkUploads(page: Page, info: TestInfo) {
  await upload(page, 'note.txt', Buffer.from('original'));
  const conflict = page.getByRole('dialog', { name: '已存在同名文件' });
  await expect(conflict).toBeVisible();
  await expect(conflict).not.toHaveClass(/ant-zoom-(enter|appear)/);
  await page.screenshot({ path: info.outputPath('ssh-upload-conflict.png'), animations: 'disabled' });
  await page.getByRole('dialog').getByRole('button', { name: /^覆\s*盖$/ }).click();
  await expect(page.getByRole('dialog', { name: '已存在同名文件' })).toBeHidden();
  await expect(entry(page, 'note.txt')).toBeVisible();
  await upload(page, 'note.txt', Buffer.from('keep both'));
  await page.getByRole('button', { name: '添加数字后缀', exact: true }).click();
  await expect(entry(page, 'note (1).txt')).toBeVisible();
  await assertDownload(page, 'note.txt', 'original');
  await assertDownload(page, 'note (1).txt', 'keep both');
  await upload(page, 'large.bin', Buffer.alloc(6 * 1024 * 1024 + 19, 0x5a));
  await expect(entry(page, 'large.bin')).toBeVisible();
  if (!await sharedBrowser(page)) await expect(entry(page, 'large.bin')).toContainText('6,291,475 B');
  await expect(page.getByText('支持 4 MB 以内的文件；上传不会覆盖同名文件。')).toBeHidden();
}

async function checkCancellation(page: Page) {
  let releaseChunk!: () => void;
  const gate = new Promise<void>(resolve => { releaseChunk = resolve; });
  const pendingChunk = page.waitForRequest(request => request.url() === `${bridge}/rpc`
    && request.method() === 'POST' && request.postDataJSON().request?.type === 'uploadChunk');
  await page.route(`${bridge}/rpc`, async route => {
    if (route.request().postDataJSON().request?.type === 'uploadChunk') await gate;
    await route.continue();
  });
  try {
    await upload(page, 'cancelled.bin', Buffer.alloc(1024 * 1024, 0x62));
    await pendingChunk;
    await page.getByRole('button', { name: '取消上传', exact: true }).click();
  } finally { releaseChunk(); }
  await expect(browser(page)).toHaveAttribute('aria-busy', 'false');
  await page.unroute(`${bridge}/rpc`);
  await page.getByRole('button', { name: /^(刷新|刷新文件树)$/ }).click();
  await expect(browser(page)).toHaveAttribute('aria-busy', 'false');
  await expect(entry(page, 'cancelled.bin')).toHaveCount(0);
  await expect(entry(page, '.remoteai-upload-')).toHaveCount(0);
}

async function checkLanguages(page: Page) {
  for (const [language, label] of [['English', 'Upload file'], ['Русский', 'Загрузить файл'],
    ['日本語', 'ファイルをアップロード'], ['中文', '上传文件']]) {
    await page.getByRole('button', { name: language, exact: true }).evaluate(element => element.click());
    await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
  }
}

async function checkMenuAndDelete(page: Page, folder: string, info: TestInfo) {
  await contextAction(page, 'note.txt', '重命名');
  await filename(page).fill('renamed.txt'); await confirm(page).click();
  await expect(entry(page, 'renamed.txt')).toBeVisible();
  await page.getByRole('button', { name: '上一级', exact: true }).click();
  await entry(page, folder).click({ button: 'right' });
  await expect(page.getByRole('menuitem', { name: '复制路径', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('ssh-files-context-light.png'), animations: 'disabled' });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toBeHidden();
  await expect(browser(page)).toBeVisible();
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await contextAction(page, folder, '复制路径');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`/${folder}`);
  await checkLanguages(page);
  await page.getByRole('button', { name: '切换主题' }).evaluate(element => element.click());
  if (page.viewportSize()!.width > 600) await page.setViewportSize({ width: 900, height: 700 });
  await entry(page, folder).click({ button: 'right' });
  await expect(page.getByRole('menuitem', { name: '复制路径', exact: true })).toBeVisible();
  if (!await sharedBrowser(page)) {
    await expect(page.locator('.ssh-file-context')).not.toHaveClass(/ant-slide-up-(enter|appear)/);
  }
  await page.screenshot({ path: info.outputPath('ssh-files-context-dark.png'), animations: 'disabled' });
  await page.getByRole('menuitem', { name: /^删\s*除$/ }).click();
  await expect(page.locator('[role="dialog"], [role="alertdialog"]')).toContainText('无法撤销');
  await page.locator('[role="dialog"], [role="alertdialog"]')
    .getByRole('button', { name: /^(删\s*除|确认删除)$/ }).click();
  await expect(entry(page, folder)).toBeHidden();
}

for (const scenario of ['local', 'remote', 'web', 'web-phone']) {
  const mode = scenario === 'web-phone' ? 'web' : scenario;
  test(`${scenario}: SSH file menus, path navigation and unlimited chunked uploads`, async ({ page }, info) => {
    test.setTimeout(120_000);
    await page.request.post(`${bridge}/reset`);
    await page.setViewportSize(scenario === 'web-phone' ? { width: 390, height: 844 } : { width: 1440, height: 920 });
    await connect(page, mode);
    const folder = `ui-${mode}-${Date.now()}`;
    await createWorkspace(page, folder);
    await checkUploads(page, info);
    await checkCancellation(page);
    await checkMenuAndDelete(page, folder, info);
  });
}
