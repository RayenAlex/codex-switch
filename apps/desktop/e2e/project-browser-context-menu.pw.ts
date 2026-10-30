import { test, expect, type Page } from '@playwright/test';

const row = (page: Page, name: string) => page.getByRole('treeitem', { name, exact: true });
const item = (page: Page, name: string) => page.getByRole('menuitem', { name, exact: true });

async function rightClickRow(page: Page, name: string, offset = 20) {
  const bounds = (await row(page, name).boundingBox())!;
  const point = { x: Math.floor(bounds.x + offset), y: Math.floor(bounds.y + bounds.height / 2) };
  // Use real hit testing so a backdrop intercepting the next right click fails the assertion.
  await page.mouse.click(point.x, point.y, { button: 'right' });
  return point;
}

async function expectTarget(page: Page, name: string) {
  await item(page, '重命名').click();
  await expect(page.getByRole('textbox', { name: '名称', exact: true })).toHaveValue(name);
  await page.getByRole('button', { name: '取消', exact: true }).click();
}

for (const mode of ['local', 'remote', 'web']) {
  test(`${mode}: repeated right clicks move the menu and target the latest file or folder`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/e2e/project-browser-harness.html?mode=${mode}`);
    await page.getByRole('button', { name: '文件浏览', exact: true }).click();
    await expect(row(page, 'src')).toBeVisible();
    const menu = page.getByRole('menu', { name: '文件操作', exact: true });

    await rightClickRow(page, 'src', 120);
    await item(page, '新建').hover();
    await expect(page.getByRole('menu', { name: '新建', exact: true })).toBeVisible();
    const point = await rightClickRow(page, 'notes.txt');
    await expect(item(page, '新建')).toHaveCount(0);
    await expect(page.getByRole('menu')).toHaveCount(1);
    await expect(menu).toHaveCSS('left', `${point.x}px`);
    await expect(menu).toHaveCSS('top', `${point.y}px`);
    await expectTarget(page, 'notes.txt');

    await rightClickRow(page, 'notes.txt', 120);
    await rightClickRow(page, 'settings.json');
    await expectTarget(page, 'settings.json');
    await rightClickRow(page, 'notes.txt', 120);
    await rightClickRow(page, 'src', 80);
    await rightClickRow(page, 'nested');
    await expect(item(page, '新建')).toBeVisible();
    await expectTarget(page, 'nested');

    await rightClickRow(page, 'src', 120);
    await row(page, 'notes.txt').click({ position: { x: 20, y: 10 } });
    await expect(menu).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'notes.txt', exact: true })).toBeVisible();
    await rightClickRow(page, 'src');
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await page.screenshot({ path: `../../.codex-tmp/project-browser-context-menu-${mode}.png` });
  });
}
