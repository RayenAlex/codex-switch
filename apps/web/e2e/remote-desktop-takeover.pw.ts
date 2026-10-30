import { expect, test } from '@playwright/test';
import type {} from './remote-desktop-takeover-fixture';

for (const entry of ['web', 'desktop'] as const) {
  test(`${entry}: confirms replacement and preserves the current viewer on cancel`, async ({ page }) => {
    await page.goto(`e2e/remote-desktop-harness.html${entry === 'desktop' ? '?native-clipboard' : ''}`);
    await page.evaluate(() => window.desktopTakeoverTest.connect());
    await expect.poll(() => page.evaluate(() => window.desktopTakeoverTest.ready)).toBe(true);
    if (entry === 'web') await page.getByRole('button', { name: '打开工具' }).click();
    await page.getByRole('button', { name: entry === 'web' ? '远程桌面' : '打开远程桌面', exact: true }).click();
    const prompt = page.getByRole('dialog', { name: '中断现有连接？', exact: true });
    await expect(prompt).toBeVisible();
    await page.screenshot({ path: test.info().outputPath('takeover.png') });
    expect((await prompt.boundingBox())!.width).toBeLessThanOrEqual(400);
    expect(await page.evaluate(() => window.desktopTakeoverTest.closed())).toBe(false);
    await prompt.getByRole('button', { name: '取消', exact: true }).click();
    await expect(prompt).not.toBeVisible();
    await expect(page.getByText('已取消连接，原有连接不受影响。')).toBeVisible();
    expect(await page.evaluate(() => window.desktopTakeoverTest.closed())).toBe(false);
    await page.locator('.rd-status button').click();
    await expect(prompt).toBeVisible();
    await prompt.getByRole('button', { name: '中断并连接', exact: true }).click();
    await expect(prompt).not.toBeVisible();
    await expect.poll(() => page.locator('.rd-video').evaluate(video => (video as HTMLVideoElement).videoWidth))
      .toBeGreaterThan(0);
    await expect.poll(() => page.evaluate(() => window.desktopTakeoverTest.closed()), { timeout: 20_000 }).toBe(true);
    await expect(page.locator('.rd-status')).not.toBeVisible();
  });
}
