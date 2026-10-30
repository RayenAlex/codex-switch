import { expect, test, type Page } from '@playwright/test';

const drawer = (page: Page) => page.locator('aside[data-details-panel]');
const project = (page: Page) => page.getByRole('combobox', { name: 'Project', exact: true });
const switchProject = (page: Page, label: string) => project(page).selectOption({ label });

async function openGit(page: Page, mode: string) {
  if (mode === 'web') {
    await page.getByRole('button', { name: '打开工具', exact: true }).click();
    await page.getByRole('button', { name: 'Git', exact: true }).click();
  } else await page.getByRole('button', { name: '打开 Git', exact: true }).click();
  await expect(drawer(page).getByRole('tab', { name: 'Git', exact: true }))
    .toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('textbox', { name: '提交说明', exact: true })).toBeVisible();
}

for (const mode of ['local', 'remote', 'web']) {
  for (const action of ['关闭详情抽屉', '最小化详情抽屉']) {
    test(`${mode}: switching projects preserves ${action} until a tool is explicitly opened`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 960 });
      await page.goto(`/e2e/workspace-drawer-harness.html?mode=${mode}`);
      await openGit(page, mode);
      await drawer(page).getByRole('button', { name: action, exact: true }).click();
      for (const label of ['Project B', 'Project A', 'Project B']) {
        await switchProject(page, label);
        await expect(drawer(page)).toBeHidden();
      }
      await page.screenshot({ path: `../../.codex-tmp/project-switch-${mode}-${action}.png` });
      await openGit(page, mode);
      await drawer(page).getByRole('button', { name: '关闭详情抽屉', exact: true }).click();
      await page.getByRole('button', { name: '文件浏览', exact: true }).click();
      await expect(drawer(page).getByRole('tab', { name: '文件浏览', exact: true }))
        .toHaveAttribute('aria-selected', 'true');
      await switchProject(page, 'Project A');
      await expect(drawer(page).getByRole('tab', { name: '文件浏览', exact: true }))
        .toHaveAttribute('aria-selected', 'true');
    });
  }
}
