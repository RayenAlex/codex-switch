import { expect, test, type Page } from '@playwright/test';

// A cold Vite server compiles the full desktop workspace before the first fixture can open.
test.setTimeout(120_000);

async function openEditor(page: Page, mode: string) {
  await page.addInitScript(() => localStorage.setItem('codex-switch.project-browser.auto-save', '0'));
  await page.goto(`/e2e/project-browser-harness.html?mode=${mode}&dark`);
  if (mode === 'mobile') await page.getByRole('button', { name: '打开工具', exact: true }).click();
  await page.getByRole('button', { name: '文件浏览', exact: true }).click();
  await page.getByRole('treeitem', { name: 'notes.txt', exact: true }).click();
  return page.getByRole('textbox', { name: '文件内容', exact: true });
}

async function expectViewport(page: Page) {
  const bounds = await page.locator('.pf-browser').boundingBox();
  const viewport = page.viewportSize()!;
  expect(bounds).toEqual({ x: 0, y: 0, ...viewport });
  await expect(page.getByRole('button', { name: '退出全屏', exact: true })).toBeInViewport();
}

for (const mode of ['local', 'remote', 'web', 'mobile']) {
  test(`${mode}: fullscreen preserves the editor, history and drawer layout`, async ({ page }) => {
    await page.setViewportSize(mode === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const editor = await openEditor(page, mode);
    const browser = page.locator('.pf-browser');
    const originalBounds = await browser.boundingBox();
    await editor.fill('fullscreen draft');
    await editor.press('End');
    const originalEditor = await editor.elementHandle();
    await page.getByRole('button', { name: '全屏浏览', exact: true }).click();
    await expect(browser).toHaveAttribute('data-fullscreen', 'true');
    await expectViewport(page);
    await expect(page.getByRole('tree')).toBeHidden();
    expect(await originalEditor!.evaluate(element => element.isConnected)).toBe(true);
    await expect(editor).toHaveText('fullscreen draft');
    await editor.pressSequentially(' preserved');
    await page.getByRole('button', { name: '撤销', exact: true }).click();
    await expect(editor).toHaveText('fullscreen draft');
    await page.getByRole('button', { name: '重做', exact: true }).click();
    await expect(editor).toHaveText('fullscreen draft preserved');
    await page.getByRole('button', { name: '查找', exact: true }).click();
    await page.getByPlaceholder('查找', { exact: true }).fill('draft');
    await page.keyboard.press('Escape');
    await expect(browser).toHaveAttribute('data-fullscreen', 'true');
    await page.keyboard.press('Escape');
    await expect(browser).toHaveAttribute('data-fullscreen', 'false');
    await expect(browser).toBeVisible();
    expect(await browser.boundingBox()).toEqual(originalBounds);
    await page.getByRole('button', { name: '全屏浏览', exact: true }).click();
    await page.screenshot({ path: `../../.codex-tmp/fullscreen-${mode}.png` });
    await page.getByRole('button', { name: '返回文件列表', exact: true }).click();
    await expect(page.getByRole('tree')).toBeVisible();
    await expectViewport(page);
    await page.getByRole('treeitem', { name: 'notes.txt', exact: true }).click();
    await expect(editor).toHaveText('fullscreen draft preserved');
    if (mode === 'mobile') {
      await page.setViewportSize({ width: 844, height: 390 });
      await expectViewport(page);
      await page.setViewportSize({ width: 390, height: 430 });
      await expectViewport(page);
    }
    await page.getByRole('button', { name: '退出全屏', exact: true }).click();
    await expect(browser).toHaveAttribute('data-fullscreen', 'false');
    expect(errors).toEqual([]);
  });
}

test('fullscreen exits when its drawer is hidden and remains available without a text editor', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page, 'web');
  await page.getByRole('button', { name: '全屏浏览', exact: true }).click();
  await page.getByRole('button', { name: '关闭文件 notes.txt', exact: true }).click();
  await expect(page.getByRole('button', { name: '退出全屏', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '退出全屏', exact: true }).click();
  await page.getByRole('button', { name: '全屏浏览', exact: true }).click();
  // Simulate the host switching away while its child occupies the top layer.
  await page.getByRole('button', { name: '最小化详情抽屉' }).evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.locator('.pf-browser')).toHaveAttribute('data-fullscreen', 'false');
  expect(await page.locator('.pf-browser').evaluate(element => element.hasAttribute('popover'))).toBe(false);
});

test('preview, split editors and older WebViews retain fullscreen controls', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(HTMLElement.prototype, 'showPopover', { value: undefined }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page, 'local');
  await page.getByRole('treeitem', { name: 'README.md', exact: true }).click();
  await expect(page.getByRole('button', { name: '全屏浏览', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '全屏浏览', exact: true }).click();
  await expectViewport(page);
  await page.getByRole('button', { name: '源码', exact: true }).click();
  await expect(page.getByRole('button', { name: '退出全屏', exact: true })).toHaveCount(1);
  await page.getByRole('tab', { name: 'README.md', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: '向右拆分', exact: true }).click();
  await expect(page.locator('.pf-editor-pane')).toHaveCount(2);
  await page.getByRole('button', { name: '退出全屏', exact: true }).first().click();
  await expect(page.locator('.pf-browser')).toHaveAttribute('data-fullscreen', 'false');
  await expect(page.locator('.pf-editor-pane')).toHaveCount(2);
});
