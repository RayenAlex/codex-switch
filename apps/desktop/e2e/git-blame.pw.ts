import { expect, test, type Locator, type Page } from '@playwright/test';

test.describe.configure({ timeout: 90_000 });

async function open(page: Page, mode: string, query = '') {
  await page.addInitScript(() => localStorage.setItem('codex-switch.project-browser.auto-save', '0'));
  await page.setViewportSize({ width: 1440, height: 960 });
  if (mode === 'local') await page.addInitScript(() => Object.assign(window, { __TAURI_INTERNALS__: {} }));
  await page.goto(`/e2e/project-browser-terminal-harness.html?mode=${mode}&scripts=1${query}`);
  await page.getByRole('button', { name: '文件浏览', exact: true }).click();
}

async function menu(page: Page, editor: Locator) {
  await editor.locator('.cm-lineNumbers .cm-gutterElement').nth(1).click({ button: 'right' });
  return page.getByRole('menuitemcheckbox', { name: /Git Blame/ });
}

for (const mode of ['local', 'remote', 'web']) {
  test(`${mode}: blame menu, draft mapping, gutter alignment and npm controls`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await open(page, mode);
    await page.getByRole('treeitem', { name: 'package.json', exact: true }).click();
    const editor = page.getByRole('tabpanel', { name: 'package.json', exact: true });
    const item = await menu(page, editor);
    await expect(item).toHaveText('显示 Git Blame');
    await expect(item).toHaveAttribute('aria-checked', 'false');
    await item.click();
    const gutter = editor.locator('.pf-blame-gutter');
    await expect(gutter).toContainText('2023-11-15  Alice 中文');
    const number = (await editor.locator('.cm-lineNumbers').boundingBox())!;
    const annotation = (await gutter.boundingBox())!;
    expect(annotation.x + annotation.width).toBeLessThanOrEqual(number.x + 1);
    await editor.getByRole('button', { name: '运行 dev', exact: true }).click();
    await expect(editor.getByRole('button', { name: '停止 dev', exact: true })).toBeVisible();
    await editor.getByRole('button', { name: '停止 dev', exact: true }).click();
    const text = editor.locator('.cm-content');
    await text.click(); await page.keyboard.press('Control+Home');
    await page.keyboard.insertText(' ');
    await expect(gutter.locator('.pf-blame-text').first()).toHaveText('未提交');
    await expect(gutter.locator('.pf-blame-label').nth(1)).toContainText('Bob');
    await page.keyboard.press('Control+z');
    await expect(gutter.locator('.pf-blame-label').first()).toContainText('Alice 中文');
    await gutter.locator('.pf-blame-label').first().hover();
    const tooltip = editor.getByRole('tooltip');
    await expect(tooltip).toBeVisible();
    expect((await tooltip.boundingBox())!.width).toBeLessThanOrEqual(400);
    await page.mouse.move(20, 20);
    await expect(tooltip).toBeHidden();
    await page.screenshot({ path: info.outputPath(`git-blame-${mode}.png`) });
    await editor.getByRole('button', { name: '全部折叠', exact: true }).click();
    await expect(gutter.locator('.pf-blame-label')).toHaveCount(1);
    await editor.getByRole('button', { name: '全部展开', exact: true }).click();
    await expect(gutter.locator('.pf-blame-label')).toHaveCount(13);
    const checked = await menu(page, editor);
    await expect(checked).toHaveText('关闭 Git Blame 批注');
    await expect(checked).toHaveAttribute('aria-checked', 'true');
    await page.screenshot({ path: info.outputPath(`git-blame-menu-${mode}.png`) });
    await checked.click();
    await expect(gutter).toHaveCount(0);
    await expect(await menu(page, editor)).toHaveText('显示 Git Blame');
    await page.keyboard.press('Escape');
    expect(errors).toEqual([]);
  });

  test(`${mode}: text files, loading cancellation, errors and offline languages`, async ({ page }) => {
    await open(page, mode);
    await page.getByRole('treeitem', { name: 'notes.txt', exact: true }).click();
    const editor = page.getByRole('tabpanel', { name: 'notes.txt', exact: true });
    await page.evaluate(() => { document.body.dataset.blameDelay = '500'; });
    await (await menu(page, editor)).click();
    await expect(editor.getByRole('status').filter({ hasText: '正在加载 Git Blame' })).toBeVisible();
    await (await menu(page, editor)).click();
    await page.waitForTimeout(600);
    await expect(editor.locator('.pf-blame-gutter')).toHaveCount(0);
    await page.evaluate(() => { document.body.dataset.blameStatus = 'notRepository'; });
    await (await menu(page, editor)).click();
    await expect(editor.getByText('此文件不在 Git 仓库中。')).toBeVisible();
    await (await menu(page, editor)).click();
    await page.evaluate(() => { document.body.dataset.blameStatus = 'ready'; });
    await (await menu(page, editor)).click();
    await expect(editor.locator('.pf-blame-gutter')).toContainText('Alice 中文');
    await editor.locator('.cm-content').click(); await page.keyboard.press('Control+Home');
    await page.keyboard.insertText('new');
    await page.context().setOffline(true);
    for (const [language, label, uncommitted, closeLabel] of [
      ['en', 'Annotate with Git Blame', 'Uncommitted', 'Hide Git Blame Annotations'],
      ['ja', 'Git Blame を表示', '未コミット', 'Git Blame の注釈を非表示'],
      ['ru', 'Показать Git Blame', 'Не закоммичено', 'Скрыть аннотации Git Blame'],
      ['zh', '显示 Git Blame', '未提交', '关闭 Git Blame 批注'],
    ]) {
      await page.evaluate(language => {
        const key = 'codex-switch.web.language.v1'; localStorage.setItem(key, language);
        window.dispatchEvent(new StorageEvent('storage', { key, newValue: language }));
      }, language);
      await expect(editor.getByRole('button', { name: label, exact: true })).toBeVisible();
      await expect(editor.locator('.pf-blame-text').first()).toHaveText(uncommitted);
      await expect(await menu(page, editor)).toHaveText(closeLabel);
      await page.keyboard.press('Escape');
    }
    await page.context().setOffline(false);
  });

  test(`${mode}: large plain text files keep annotations on visible lines`, async ({ page }) => {
    await open(page, mode, '&large=1');
    await page.getByRole('treeitem', { name: 'large.ts', exact: true }).click();
    const editor = page.getByRole('tabpanel', { name: 'large.ts', exact: true });
    await expect(editor.locator('.pf-editor')).toHaveAttribute('data-plain-text', 'true');
    await (await menu(page, editor)).click();
    await expect(editor.locator('.pf-blame-gutter')).toContainText('Alice 中文');
    await editor.locator('.pf-blame-label').first().hover();
    await expect(editor.getByRole('tooltip')).toBeVisible();
    await editor.locator('.cm-scroller').evaluate(element => { element.scrollTop = 2000; });
    await expect(editor.getByRole('tooltip')).toBeHidden();
    await expect(editor.locator('.pf-blame-label').first()).toBeVisible();
    expect(await editor.locator('.pf-blame-label').count()).toBeLessThan(100);
  });
}
