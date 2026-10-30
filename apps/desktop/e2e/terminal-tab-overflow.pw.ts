import { expect, test, type Locator } from '@playwright/test';

async function selectedVisible(strip: Locator) {
  await expect.poll(() => strip.evaluate(element => {
    const viewport = element.getBoundingClientRect();
    const tab = element.querySelector('[data-active=true]')?.getBoundingClientRect();
    return !!tab && tab.left >= viewport.left - 1 && tab.right <= viewport.right + 1;
  })).toBe(true);
}

for (const [mode, width] of [['local', 600], ['remote', 600], ['web', 600], ['web', 390]] as const) {
  test(`${mode} ${width}: terminal tabs close individually and overflow into the menu`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`/e2e/ssh-harness.html?mode=${mode}&cloud=1`);
    await page.getByRole('button', { name: mode === 'web' ? '打开远程终端' : '打开终端', exact: true }).click();
    const strip = page.getByRole('tablist', { name: '终端标签页' });
    for (let count = 2; count <= 8; count++) {
      await page.getByRole('button', { name: '新建终端', exact: true }).click();
      await expect(strip.getByRole('tab')).toHaveCount(count);
    }
    const selected = await strip.locator('[role=tab][aria-selected=true]').getAttribute('id');
    const more = page.getByRole('button', { name: '更多终端', exact: true });
    await expect(more).toBeVisible(); await selectedVisible(strip);
    await more.click();
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    expect((await menu.boundingBox())!.width).toBeLessThanOrEqual(400);
    await page.screenshot({ path: info.outputPath('terminal-tab-menu.png'), animations: 'disabled' });
    await menu.getByRole('button', { name: '关闭终端 1', exact: true }).click();
    await expect(strip.getByRole('tab')).toHaveCount(7);
    await expect(strip.locator('[role=tab][aria-selected=true]')).toHaveAttribute('id', selected!);
    await menu.getByText('/fixture', { exact: true }).first().click();
    await expect(menu).toBeHidden(); await selectedVisible(strip);
    await strip.locator('[data-active=true]').getByRole('button').click();
    await expect(strip.getByRole('tab')).toHaveCount(6);
    await selectedVisible(strip);
    await page.screenshot({ path: info.outputPath('terminal-tab-close.png'), animations: 'disabled' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(more).toHaveCount(0); await selectedVisible(strip);
  });
}
