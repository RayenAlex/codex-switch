import { test, expect, type Page } from '@playwright/test';

const row = (page: Page, name: string) => page.getByRole('treeitem', { name, exact: true });
const search = (page: Page) => page.getByRole('searchbox', { name: '搜索文件或文件夹' });

for (const mode of ['local', 'remote', 'web', 'mobile']) {
  test(`${mode}: search unopened paths, open files, use context actions and reveal folders`, async ({ page }) => {
    await page.setViewportSize(mode === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
    await page.goto(`/e2e/project-browser-harness.html?mode=${mode}`);
    if (mode === 'mobile') await page.getByRole('button', { name: '打开工具', exact: true }).click();
    await page.getByRole('button', { name: '文件浏览', exact: true }).click();
    await expect(search(page)).toBeVisible();
    await expect(row(page, 'main.ts')).toHaveCount(0);
    await search(page).fill('MAIN.TS');
    await expect(row(page, 'main.ts')).toContainText('src/main.ts');
    await expect(row(page, 'notes.txt')).toHaveCount(0);
    await page.screenshot({ path: `../../.codex-tmp/project-browser-search-${mode}.png` });
    await row(page, 'main.ts').click();
    await expect(page.getByRole('textbox', { name: '文件内容', exact: true })).toContainText('export function');
    if (mode === 'mobile') await page.getByRole('button', { name: '返回文件列表' }).click();
    await row(page, 'main.ts').click({ button: 'right' });
    await page.getByRole('menuitem', { name: '重命名', exact: true }).click();
    await page.getByRole('textbox', { name: '名称', exact: true }).fill('renamed.ts');
    await page.getByRole('button', { name: '确定', exact: true }).click();
    await expect(page.getByText('未找到匹配的文件或文件夹', { exact: true })).toBeVisible();
    await search(page).fill('src\\renamed');
    await expect(row(page, 'renamed.ts')).toContainText('src/renamed.ts');
    await page.getByRole('button', { name: '清空搜索' }).click();
    await expect(search(page)).toHaveValue('');
    await expect(row(page, 'src')).toHaveAttribute('aria-expanded', 'true');
    await search(page).fill('子目录');
    await expect(row(page, '子目录')).toContainText('nested/子目录');
    await row(page, '子目录').click();
    await expect(search(page)).toHaveValue('');
    await expect(row(page, '子目录')).toHaveAttribute('aria-expanded', 'true');
    await expect(row(page, '测试.py')).toBeVisible();
    await expect(row(page, 'src')).toHaveAttribute('aria-expanded', 'true');
    await search(page).fill('no-such-file');
    await expect(page.getByText('未找到匹配的文件或文件夹', { exact: true })).toBeVisible();
    await search(page).press('Escape');
    await expect(row(page, '测试.py')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      mode === 'mobile' ? 390 : 1440);
  });
}

test('search stays readable in a narrow dark file tree and refreshes after reconnecting', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto('/e2e/project-browser-harness.html?mode=remote&dark');
  await page.getByRole('button', { name: '文件浏览', exact: true }).click();
  await search(page).fill('notes');
  await expect(row(page, 'notes.txt')).toBeVisible();
  await page.getByRole('button', { name: '切换连接', exact: true }).click();
  await expect(search(page)).toBeDisabled();
  await expect(row(page, 'notes.txt')).toHaveCount(0);
  await page.getByRole('button', { name: '切换连接', exact: true }).click();
  await expect(row(page, 'notes.txt')).toBeVisible();
  await page.screenshot({ path: '../../.codex-tmp/project-browser-search-dark.png' });
});
