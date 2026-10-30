import { expect, test, type Locator, type Page } from '@playwright/test';
import { sshEditorFixture } from './ssh-editor-fixture';

const row = (page: Page, name: string) => page.getByRole('treeitem', { name, exact: true });
const uploadLabel = '上传到此文件夹';

async function openBrowser(page: Page, mode: string) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const fixture = await sshEditorFixture(page);
  await page.goto(`/e2e/ssh-harness.html?mode=${mode}&cloud=1`);
  await page.getByRole('button', { name: mode === 'web' ? '打开远程终端' : '打开终端', exact: true }).click();
  await page.getByRole('button', { name: '终端连接选项' }).click();
  await page.getByRole('menuitem', { name: 'Editor server', exact: true }).click();
  await page.getByRole('button', { name: '远程文件浏览', exact: true }).click();
  await expect(row(page, 'hello.txt')).toBeVisible();
  return fixture;
}

async function chooseUpload(page: Page, target: Locator, name: string) {
  await target.click({ button: 'right', position: { x: 20, y: 20 } });
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: uploadLabel, exact: true }).click();
  await (await chooser).setFiles({ name, mimeType: 'text/plain', buffer: Buffer.from(name) });
  await expect(page.locator('.ssh-project-browser')).toHaveAttribute('aria-busy', 'false');
}

async function dragUpload(page: Page, options: { target: Locator; name: string; directory: string }) {
  await expect(page.locator('.ssh-project-browser')).toHaveAttribute('aria-busy', 'false');
  const data = await page.evaluateHandle(name => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([name], name));
    return transfer;
  }, options.name);
  await options.target.dispatchEvent('dragover', { dataTransfer: data });
  await expect(page.locator('.ssh-drop-overlay')).toHaveText(`松开以上传到 ${options.directory}`);
  await options.target.dispatchEvent('drop', { dataTransfer: data });
  await data.dispose();
  await expect(page.locator('.ssh-drop-overlay')).toHaveCount(0);
  await expect(page.locator('.ssh-project-browser')).toHaveAttribute('aria-busy', 'false');
}

async function checkCurrentFolder(page: Page, files: Map<string, Buffer | null>) {
  const path = page.getByRole('textbox', { name: '远程路径' });
  await path.fill('/中文目录'); await path.press('Enter');
  await expect(row(page, 'nested.txt')).toBeVisible();
  await dragUpload(page, { target: page.getByRole('tree'), name: 'current.txt', directory: '/中文目录' });
  await expect.poll(() => files.get('/中文目录/current.txt')?.toString()).toBe('current.txt');
  const tree = page.getByRole('tree');
  await tree.click({ button: 'right', position: { x: 20, y: (await tree.boundingBox())!.height - 20 } });
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: uploadLabel, exact: true }).click();
  await (await chooser).setFiles({ name: 'blank.txt', mimeType: 'text/plain', buffer: Buffer.from('blank') });
  await expect.poll(() => files.get('/中文目录/blank.txt')?.toString()).toBe('blank');
}

async function checkMenuLanguages(page: Page) {
  for (const [language, label] of [
    ['English', 'Upload to this folder'],
    ['Русский', 'Загрузить в эту папку'],
    ['日本語', 'このフォルダーにアップロード'],
    ['中文', uploadLabel],
  ]) {
    await page.getByRole('button', { name: language, exact: true }).evaluate(button => button.click());
    await page.locator('.pf-tree-heading button, .ssh-project-actions button').last().click();
    await expect(page.getByRole('menuitem', { name: label, exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
  }
}

for (const mode of ['local', 'remote', 'web']) {
  test(`${mode}: SSH folder menus and drop targets select the upload directory`, async ({ page }, info) => {
    const { files } = await openBrowser(page, mode);
    const folder = row(page, '中文目录');
    await folder.click();
    await chooseUpload(page, folder, 'menu.txt');
    await expect.poll(() => files.get('/中文目录/menu.txt')?.toString()).toBe('menu.txt');
    await expect(page.getByRole('textbox', { name: '远程路径' })).toHaveValue('/');
    await expect(folder).toHaveAttribute('aria-expanded', 'true');
    await expect(row(page, 'menu.txt')).toBeVisible();
    await dragUpload(page, { target: folder.locator('svg').first(), name: 'folder.txt', directory: '/中文目录' });
    await expect.poll(() => files.get('/中文目录/folder.txt')?.toString()).toBe('folder.txt');
    await dragUpload(page, { target: row(page, 'nested.txt').locator('.pf-tree-entry'),
      name: 'beside.txt', directory: '/中文目录' });
    await expect.poll(() => files.get('/中文目录/beside.txt')?.toString()).toBe('beside.txt');
    await dragUpload(page, { target: page.getByRole('tree'), name: 'root.txt', directory: '/' });
    await expect.poll(() => files.get('/root.txt')?.toString()).toBe('root.txt');
    await dragUpload(page, { target: row(page, 'hello.txt'), name: 'root-file.txt', directory: '/' });
    await expect.poll(() => files.get('/root-file.txt')?.toString()).toBe('root-file.txt');
    await row(page, 'hello.txt').click({ button: 'right' });
    await expect(page.getByRole('menuitem', { name: uploadLabel })).toHaveCount(0);
    await page.keyboard.press('Escape');
    const search = page.getByRole('searchbox', { name: '搜索文件或文件夹' });
    await search.fill('nested');
    await expect(row(page, 'nested.txt')).toBeVisible();
    await dragUpload(page, { target: row(page, 'nested.txt'), name: 'search.txt', directory: '/中文目录' });
    await expect.poll(() => files.get('/中文目录/search.txt')?.toString()).toBe('search.txt');
    await search.fill('');
    const tree = page.getByRole('tree');
    await tree.click({ button: 'right', position: { x: 20, y: (await tree.boundingBox())!.height - 20 } });
    await expect(page.getByRole('menuitem', { name: uploadLabel })).toBeVisible();
    await page.screenshot({ path: info.outputPath(`ssh-upload-menu-${mode}.png`) });
    await page.keyboard.press('Escape');
    expect(files.has('/folder.txt')).toBe(false);
    expect(files.has('/beside.txt')).toBe(false);
    expect(files.has('/search.txt')).toBe(false);
    await checkCurrentFolder(page, files);
    await checkMenuLanguages(page);
  });
}
