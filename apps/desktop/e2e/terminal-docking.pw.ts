import { expect, test } from '@playwright/test';

for (const mode of ['local', 'remote', 'web']) {
  test(`${mode}: bottom terminal resizes, coexists with details, and stays hidden after switching projects`,
    async ({ page }, info) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`/e2e/workspace-drawer-harness.html?mode=${mode}`);
    const open = () => page.getByRole('button', { name: '打开远程终端', exact: true }).click();
    const panel = page.getByRole('region', { name: '终端', exact: true });
    await open();
    await expect(panel.locator('.xterm')).toBeVisible();
    await expect(page.locator('aside[data-details-panel]:visible')).toHaveCount(0);
    const bounds = (await panel.boundingBox())!;
    expect(Math.round(bounds.width)).toBe(1440);
    expect(Math.round(bounds.y + bounds.height)).toBe(960);
    expect(Math.round(bounds.height)).toBe(300);
    await panel.getByRole('separator', { name: '调整终端高度', exact: true }).press('ArrowUp');
    await expect.poll(async () => (await panel.boundingBox())!.height).toBe(324);
    await page.getByRole('button', { name: '文件浏览', exact: true }).click();
    await expect(panel).toBeVisible();
    await expect(page.getByRole('tab', { name: '远程终端', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: '关闭详情抽屉', exact: true }).click();
    await panel.getByRole('button', { name: '收起终端', exact: true }).click();
    await expect(panel).toBeHidden();
    for (const label of ['Project B', 'Project A']) {
      await page.getByRole('combobox', { name: 'Project', exact: true }).selectOption({ label });
      await expect(panel).toBeHidden();
      await expect(page.locator('aside[data-details-panel]:visible')).toHaveCount(0);
    }
    await open();
    await expect(panel.locator('.xterm')).toBeVisible();
    await expect(page.locator('body')).toHaveAttribute('data-terminal-opens', '1');
    await page.screenshot({ path: info.outputPath(`bottom-terminal-${mode}.png`) });
  });
}

test.describe('phone terminal', () => {
  test.use({ isMobile: true, hasTouch: true, viewport: { width: 390, height: 844 } });
  test('retains a bottom sheet and shortcuts through wide landscape and keyboard heights', async ({ page }, info) => {
    await page.goto('/e2e/workspace-drawer-harness.html?mode=web');
    await page.getByRole('button', { name: '打开远程终端', exact: true }).click();
    const drawer = page.getByRole('dialog', { name: '远程终端', exact: true });
    await expect(drawer.locator('.xterm')).toBeVisible();
    for (const viewport of [{ width: 915, height: 412 }, { width: 915, height: 250 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await expect(drawer.getByRole('button', { name: '收起终端', exact: true })).toBeInViewport({ ratio: 1 });
      await expect(drawer.getByRole('button', { name: 'Ctrl+C', exact: true })).toBeInViewport({ ratio: 1 });
      await expect(drawer.locator('.xterm-screen')).toBeInViewport({ ratio: 1 });
    }
    await expect(page.locator('body')).toHaveAttribute('data-terminal-opens', '1');
    await page.screenshot({ path: info.outputPath('phone-terminal.png') });
  });
});
