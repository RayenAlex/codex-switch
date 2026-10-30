import { expect, test } from '@playwright/test';

for (const mode of ['local', 'remote', 'web']) {
  test(`${mode}: dark file browser paints its loading surface before the module arrives`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    // An explicit app preference must work even when the operating system uses light mode.
    await page.emulateMedia({ colorScheme: 'light' });
    let releaseModule = () => {};
    const moduleReady = new Promise<void>(resolve => { releaseModule = resolve; });
    await page.route('**/shared/project-browser/ProjectBrowser.tsx', async route => {
      await moduleReady;
      await route.continue();
    });
    await page.goto(`/e2e/project-browser-theme-harness.html?mode=${mode}&dark`);
    await page.getByRole('button', { name: '文件浏览', exact: true }).click();
    const drawer = page.locator('aside[data-details-panel]');
    const panel = page.locator('.project-browser-drawer');
    const shell = mode === 'web' ? 'rgb(27, 32, 30)' : 'rgb(23, 25, 28)';
    const surface = mode === 'web' ? 'rgb(20, 20, 20)' : shell;
    try {
      await expect(panel.getByRole('status')).toBeVisible();
      await expect(drawer).toHaveCSS('background-color', shell);
      await expect(panel).toHaveCSS('background-color', surface);
      await page.screenshot({ path: test.info().outputPath('dark-loading.png') });
    } finally {
      releaseModule();
    }
    await expect(page.getByRole('treeitem', { name: 'src', exact: true })).toBeVisible();
    await expect(page.locator('.pf-browser')).toHaveCSS('background-color', surface);
    await page.screenshot({ path: test.info().outputPath('dark-loaded.png') });
    await page.getByRole('button', { name: '关闭详情抽屉', exact: true }).click();
    await page.getByRole('button', { name: '文件浏览', exact: true }).click();
    await expect(drawer).toHaveCSS('background-color', shell);
    await page.getByRole('button', { name: '切换主题', exact: true }).evaluate(button => {
      (button as HTMLButtonElement).click();
    });
    await expect(drawer).toHaveCSS('background-color', 'rgb(251, 252, 250)');
    await expect(panel).toHaveCSS('background-color', mode === 'web' ? 'rgb(255, 255, 255)' : 'rgb(251, 252, 250)');
    await page.screenshot({ path: test.info().outputPath('light-loaded.png') });
  });
}
