import { expect, test, type Locator, type Page } from '@playwright/test';

const drawer = (page: Page) => page.locator('aside[data-details-panel]');
const tabs = (page: Page) => drawer(page).getByRole('tablist', { name: '侧栏内容', exact: true });

async function openAllDrawers(page: Page, mode: string) {
  await page.getByRole('button', { name: '文件浏览', exact: true }).click();
  await page.getByRole('treeitem', { name: 'notes.txt', exact: true }).click();
  await page.getByRole('button', { name: '打开预览', exact: true }).click();
  await page.getByRole('button', { name: '打开任务验收', exact: true }).click();
  await page.getByRole('button', { name: '打开远程终端', exact: true }).click();
  if (mode === 'web') {
    await page.getByRole('button', { name: '打开工具', exact: true }).click();
    await page.getByRole('button', { name: 'Git', exact: true }).click();
  } else await page.getByRole('button', { name: '打开 Git', exact: true }).click();
  await expect(tabs(page).getByRole('tab')).toHaveCount(5);
  await page.getByRole('tab', { name: '提交记录', exact: true }).click();
}

async function expectUnclipped(menu: Locator) {
  await expect.poll(() => menu.evaluateAll(elements => {
    if (elements.length !== 1) return false;
    const element = elements[0];
    const popup = element.closest('.git-toolbar-popover')!;
    if (getComputedStyle(popup).opacity !== '1') return false;
    const rect = element.getBoundingClientRect();
    const points = [[rect.left + 12, rect.top + 12], [rect.right - 12, rect.top + 12],
      [rect.left + 12, rect.bottom - 12], [rect.right - 12, rect.bottom - 12]];
    return rect.width > 0 && rect.width <= 400 && element.scrollWidth <= element.clientWidth
      && points.every(([x, y]) => element.contains(document.elementFromPoint(x, y)));
  })).toBe(true);
}

for (const mode of ['local', 'remote', 'web']) {
  test(`${mode}: Git menus remain visible with every drawer open and resized`, async ({ page }, info) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/e2e/workspace-drawer-harness.html?mode=${mode}${mode === 'remote' ? '&dark' : ''}`);
    await openAllDrawers(page, mode);
    const menu = page.locator('.git-menu:visible');
    const grip = drawer(page).getByRole('separator', { name: '调整详情抽屉宽度' });
    for (const width of [560, 300]) {
      if (width === 300) await grip.press('Home');
      for (const action of ['获取 Fetch', '拉取 Pull', '更新项目', '推送 Push', '切换分支']) {
        await page.getByRole('button', { name: action, exact: true }).click();
        await expectUnclipped(menu);
        if (action === '拉取 Pull') {
          await menu.getByRole('combobox', { name: '整合方式' }).selectOption('rebase');
          await page.screenshot({ path: info.outputPath(`pull-${width}.png`), animations: 'disabled' });
        }
        await page.getByRole('button', { name: action, exact: true }).press('Escape');
        await expect(menu).toHaveCount(0);
        await expect(drawer(page)).toBeVisible();
      }
    }
    await page.getByRole('button', { name: '更新项目', exact: true }).click();
    await grip.press('End');
    await expectUnclipped(menu);
    await drawer(page).getByRole('button', { name: '展开详情抽屉', exact: true }).click();
    await page.getByRole('button', { name: '拉取 Pull', exact: true }).click();
    await expectUnclipped(menu);
    await tabs(page).getByRole('tab', { name: '文件浏览', exact: true }).click();
    await expect(menu).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: '文件内容', exact: true })).toBeVisible();
    await tabs(page).getByRole('tab', { name: 'Git', exact: true }).click();
    await page.getByRole('button', { name: '拉取 Pull', exact: true }).click();
    await expectUnclipped(menu);
    await drawer(page).getByRole('button', { name: '最小化详情抽屉', exact: true }).click();
    await expect(menu).toHaveCount(0);
    await expect(page.getByRole('region', { name: '终端', exact: true })).toBeVisible();
  });
}
