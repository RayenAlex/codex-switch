import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { sshEditorFixture } from './ssh-editor-fixture';

test.use({ hasTouch: true });
const entry = (page: Page, name: string) => page.locator('.ssh-file-list button').filter({ hasText: name });
const editor = (page: Page) => page.locator('.ssh-file-editor');

async function connect(page: Page, scenario: string) {
  const mode = scenario === 'web-phone' ? 'web' : scenario;
  await page.setViewportSize({ width: scenario === 'web-phone' ? 390 : 1440, height: 844 });
  await page.goto(`/e2e/ssh-harness.html?mode=${mode}&cloud=1`);
  await page.getByRole('button', { name: mode === 'web' ? '打开远程终端' : '打开终端', exact: true }).click();
  await page.getByRole('button', { name: '终端连接选项' }).click();
  await page.getByRole('menuitem', { name: 'Editor server', exact: true }).click();
  await page.getByRole('button', { name: '远程文件浏览', exact: true }).click();
  await expect(entry(page, 'hello.txt')).toBeVisible();
}

async function longPress(page: Page, name: string) {
  const box = (await entry(page, name).boundingBox())!;
  const client = await page.context().newCDPSession(page);
  try {
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart',
      touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
    await expect(page.getByRole('menuitem', { name: '重命名', exact: true })).toBeVisible();
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally { await client.detach(); }
}

async function checkDraftProtection(page: Page) {
  await page.getByLabel('文件内容').fill('unsaved draft');
  await editor(page).getByRole('button', { name: '关闭文件', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '放弃未保存的修改？' });
  await expect(dialog).toBeVisible();
  expect((await dialog.boundingBox())!.width).toBeLessThanOrEqual(400);
  await dialog.getByRole('button', { name: /^取\s*消$/ }).click();
  await expect(page.getByLabel('文件内容')).toHaveValue('unsaved draft');
  await editor(page).getByRole('button', { name: '关闭文件', exact: true }).click();
  await dialog.getByRole('button', { name: '放弃修改', exact: true }).click();
  await expect(editor(page)).toHaveCount(0);
}

async function checkLocales(page: Page, info: TestInfo) {
  for (const [language, label] of [['English', 'Save file'], ['Русский', 'Сохранить файл'], ['日本語', 'ファイルを保存'],
    ['中文', '保存文件']] as const) {
    await page.getByRole('button', { name: language, exact: true }).evaluate(button => button.click());
    await expect(editor(page).getByRole('button', { name: label, exact: true })).toBeVisible();
  }
  await page.screenshot({ path: info.outputPath('ssh-editor-light.png'), animations: 'disabled' });
  await page.getByRole('button', { name: '切换主题' }).evaluate(button => button.click());
  await page.screenshot({ path: info.outputPath('ssh-editor-dark.png'), animations: 'disabled' });
}

// PC uses the shared tree/editor workspace, covered by ssh-project-browser.pw.ts.
for (const scenario of ['web-phone']) {
  test(`${scenario}: tap navigation, long press actions and editable text files`, async ({ page }, info) => {
    test.setTimeout(60_000);
    const fixture = await sshEditorFixture(page);
    await connect(page, scenario);
    await expect(page.locator('.ssh-file-actions')).toHaveCount(0);
    await expect(page.getByText('上传同名文件时，可选择覆盖或添加数字后缀。')).toHaveCount(0);
    await entry(page, '中文目录').click();
    await expect(page.getByRole('textbox', { name: '远程路径' })).toHaveValue('/中文目录');
    await page.getByRole('button', { name: '上一级', exact: true }).click();
    await entry(page, 'script.ts').click();
    await expect(page.getByLabel('文件内容')).toHaveValue('const greeting = "你好";\n');
    const content = 'const greeting = "编辑后的代码";\nconsole.log(greeting);\n';
    await page.getByLabel('文件内容').fill(content);
    fixture.failNextSave();
    await editor(page).getByRole('button', { name: '保存文件', exact: true }).click();
    await expect(editor(page).getByRole('alert')).toContainText('文件操作失败');
    await expect(page.getByLabel('文件内容')).toHaveValue(content);
    await editor(page).getByRole('button', { name: '保存文件', exact: true }).click();
    await expect(editor(page).getByRole('status')).toContainText('已保存');
    expect(fixture.files.get('/script.ts')!.toString()).toBe(`\ufeff${content.replaceAll('\n', '\r\n')}`);
    await checkLocales(page, info);
    await checkDraftProtection(page);
    await entry(page, 'script.ts').click();
    await expect(page.getByLabel('文件内容')).toHaveValue(content);
    await editor(page).getByRole('button', { name: '关闭文件', exact: true }).click();
    await longPress(page, 'hello.txt');
    await expect(editor(page)).toHaveCount(0);
    await expect(page.getByRole('menuitem')).toHaveCount(2);
    await expect(page.getByRole('menuitem', { name: '删除', exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath('ssh-long-press.png'), animations: 'disabled' });
    await page.getByRole('menuitem', { name: '重命名', exact: true }).click();
    await page.getByLabel('文件名').fill('renamed.txt');
    await page.getByRole('dialog').getByRole('button', { name: /^确\s*定$/ }).click();
    await expect(entry(page, 'renamed.txt')).toBeVisible();
    await entry(page, 'renamed.txt').focus(); await page.keyboard.press('Shift+F10');
    await page.getByRole('menuitem', { name: '删除', exact: true }).click();
    await page.getByRole('dialog', { name: '删除', exact: true }).getByRole('button', { name: /^删\s*除$/ }).click();
    await expect(entry(page, 'renamed.txt')).toHaveCount(0);
    const download = page.waitForEvent('download');
    await entry(page, 'image.bin').click();
    expect((await download).suggestedFilename()).toBe('image.bin');
    await expect(editor(page)).toHaveCount(0);
  });
}
