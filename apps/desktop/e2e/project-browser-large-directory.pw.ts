import { expect, test } from '@playwright/test';

for (const mode of ['local', 'remote', 'web']) {
  test(`${mode}: browse and open files beyond both former directory limits`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/e2e/project-browser-harness.html?mode=${mode}&largeDirectory`);
    await page.getByRole('button', { name: '文件浏览', exact: true }).click();
    const folder = page.getByRole('treeitem', { name: 'node_modules', exact: true });
    await folder.click();
    await expect(page.getByRole('treeitem', { name: /^package-\d+\.json$/ })).toHaveCount(10_001);
    await expect(page.getByText('文件较多，仅显示前 500 项。', { exact: true })).toHaveCount(0);
    for (const index of [500, 10_000]) {
      const file = `package-${String(index).padStart(5, '0')}.json`;
      await page.getByRole('treeitem', { name: file, exact: true }).click();
      await expect(page.getByRole('textbox', { name: '文件内容', exact: true }))
        .toContainText(JSON.stringify({ index }));
    }
    await page.screenshot({ path: `../../.codex-tmp/project-browser-large-${mode}.png` });
    await folder.click();
    await expect(page.getByRole('treeitem', { name: /^package-\d+\.json$/ })).toHaveCount(0);
    await folder.click();
    await expect(page.getByRole('treeitem', { name: 'package-10000.json', exact: true })).toHaveCount(1);
    await page.getByRole('button', { name: '刷新文件树', exact: true }).click();
    await expect(page.getByRole('treeitem', { name: /^package-\d+\.json$/ })).toHaveCount(0);
    await folder.click();
    await expect(page.getByRole('treeitem', { name: /^package-\d+\.json$/ })).toHaveCount(10_001);
  });
}
