import { expect, test, type Page } from '@playwright/test';

async function openEditor(page: Page, mode: string) {
  await page.setViewportSize(mode === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
  await page.goto(`/e2e/project-browser-harness.html?mode=${mode}`);
  if (mode === 'mobile') await page.getByRole('button', { name: '打开工具', exact: true }).click();
  await page.getByRole('button', { name: '文件浏览', exact: true }).click();
  await page.getByRole('treeitem', { name: 'notes.txt', exact: true }).click();
  const editor = page.getByRole('textbox', { name: '文件内容', exact: true });
  await editor.fill('alpha Alpha alphabet\nalpha beta');
  await editor.press('Control+Home');
  return editor;
}

for (const mode of ['local', 'remote', 'web', 'mobile']) {
  test(`${mode}: find toggles, replacement stays collapsed until requested and commands work`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const editor = await openEditor(page, mode);
    const toggle = page.getByRole('button', { name: '查找', exact: true });
    const panel = page.locator('.pf-search-panel');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(panel.locator('[name=close]')).toHaveCount(0);
    const query = panel.getByRole('textbox', { name: '查找', exact: true });
    const replacement = panel.getByRole('textbox', { name: '替换', exact: true });
    const disclosure = panel.locator('.pf-search-disclosure');
    await expect(query).toBeFocused();
    await expect(replacement).toBeHidden();
    await query.fill('alpha');
    await expect(panel.getByRole('status')).toHaveText('1 / 4');
    await expect(replacement).toBeHidden();
    await query.press('Enter');
    await expect(panel.getByRole('status')).toHaveText('2 / 4');
    await query.press('Shift+Enter');
    await expect(panel.getByRole('status')).toHaveText('1 / 4');
    await panel.getByRole('button', { name: '区分大小写', exact: true }).click();
    await expect(panel.getByRole('status')).toHaveText('1 / 3');
    await panel.getByRole('button', { name: '全字匹配', exact: true }).click();
    await expect(panel.getByRole('status')).toHaveText('1 / 2');
    await disclosure.click();
    await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    await replacement.fill('gamma');
    await page.screenshot({ path: `../../.codex-tmp/project-browser-find-${mode}.png` });
    await panel.locator('.pf-search-replace').click();
    await expect(editor).toContainText('gamma Alpha alphabet');
    await panel.getByRole('button', { name: '全部替换', exact: true }).click();
    await expect(editor).toContainText('gamma beta');
    await expect(panel.getByRole('status')).toHaveText('0 / 0');
    await disclosure.click();
    await expect(replacement).toBeHidden();
    await disclosure.click();
    await expect(replacement).toHaveValue('gamma');
    await toggle.click();
    await expect(panel).toHaveCount(0);
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.click();
    await expect(replacement).toBeHidden();
    await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    await query.press('Escape');
    await expect(panel).toHaveCount(0);
    await editor.press('Control+f');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(replacement).toBeHidden();
    await expect(query).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      mode === 'mobile' ? 390 : 1440);
    expect(errors).toEqual([]);
  });
}

test('regular expressions, select all, undo and disconnect keep find and replace safe', async ({ page }) => {
  const editor = await openEditor(page, 'remote');
  await page.getByRole('button', { name: '查找', exact: true }).click();
  const panel = page.locator('.pf-search-panel');
  const query = panel.getByRole('textbox', { name: '查找', exact: true });
  await panel.getByRole('button', { name: '正则表达式', exact: true }).click();
  await query.fill('[');
  await expect(query).toHaveAttribute('aria-invalid', 'true');
  await expect(panel.getByRole('status')).toHaveText('0 / 0');
  await query.fill('alph[a-z]+');
  await expect(panel.getByRole('status')).toHaveText('1 / 4');
  await panel.getByRole('button', { name: '全选', exact: true }).click();
  await editor.press('x');
  await expect(editor).toHaveText('x x xx beta');
  await editor.press('Control+z');
  await expect(editor).toContainText('alpha Alpha alphabet');
  await panel.locator('.pf-search-disclosure').click();
  await page.getByRole('button', { name: '切换连接', exact: true }).click();
  await expect(panel.locator('.pf-search-disclosure')).toBeDisabled();
  await expect(panel.getByRole('textbox', { name: '替换', exact: true })).toBeHidden();
  await query.fill('beta');
  await expect(panel.getByRole('status')).toHaveText('1 / 1');
});
