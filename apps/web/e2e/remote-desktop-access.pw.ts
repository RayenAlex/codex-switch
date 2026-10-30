import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { desktopTest } from './remote-desktop-fixture';

declare global { interface Window { desktopTest: typeof desktopTest } }
const locked = 'client.remoteDesktop.lockedRequiresUnattended';
const privacy = 'client.remoteDesktop.privacyRequiresUnattended';
const privacyFailed = 'client.remoteDesktop.privacyFailed';
const copy = JSON.parse(readFileSync(new URL(
  '../../../packages/i18n/src/catalogs/client/zh/remoteDesktopAccess.json', import.meta.url), 'utf8')) as Record<string, string>;

async function open(page: Page, desktop: boolean, query: string) {
  await page.goto(`e2e/remote-desktop-harness.html?${query}${desktop ? '&native-clipboard' : ''}`);
  if (desktop) await page.getByRole('button', { name: '打开远程桌面', exact: true }).click();
  else {
    await page.getByRole('button', { name: '打开工具', exact: true }).click();
    await page.getByRole('button', { name: '远程桌面', exact: true }).click();
  }
}

async function visibleGuidance(page: Page, key: typeof locked | typeof privacy | typeof privacyFailed) {
  const message = page.getByText(copy[key], { exact: true });
  await expect(message).toHaveText(copy[key]);
  const layout = await message.evaluate(element => {
    const box = element.getBoundingClientRect();
    const range = document.createRange(); range.selectNodeContents(element);
    const parent = element.closest('.rd-security-settings')?.querySelector('.rd-security-scroll');
    return { width: box.width, onscreen: box.left >= 0 && box.top >= 0
      && box.right <= innerWidth && box.bottom <= innerHeight,
      outsideScroll: !parent?.contains(element),
      complete: Array.from(range.getClientRects()).every(rect => rect.left >= box.left && rect.right <= box.right
        && rect.top >= box.top && rect.bottom <= box.bottom) };
  });
  expect(layout).toMatchObject({ onscreen: true, complete: true, outsideScroll: true });
  expect(layout.width).toBeLessThanOrEqual(400);
}

for (const desktop of [false, true]) {
  for (const key of [locked, privacyFailed] as const) {
    test(`retains ${key} at startup in ${desktop ? 'desktop' : 'web'} viewer`, async ({ page }, info) => {
      await open(page, desktop, `access-error=${key}`);
      await visibleGuidance(page, key);
      await page.waitForTimeout(2500);
      expect(await page.evaluate(() => window.desktopTest.captureAttempts)).toBe(1);
      await visibleGuidance(page, key);
      await page.screenshot({ path: info.outputPath('access-guidance.png') });
      await page.evaluate(() => { window.desktopTest.accessError = ''; });
      await page.getByRole('button', { name: '重新连接', exact: true }).click();
      await expect.poll(() => page.locator('video').evaluate(video => video.videoWidth)).toBeGreaterThan(0);
      await expect(page.locator('.rd-status')).not.toBeVisible();
    });
  }

  test(`delivers a lock reason over live media in ${desktop ? 'desktop' : 'web'} viewer`, async ({ page }) => {
    await open(page, desktop, '');
    await expect.poll(() => page.locator('video').evaluate(video => video.videoWidth)).toBeGreaterThan(0);
    const attempts = await page.evaluate(() => {
      window.desktopTest.accessError = 'client.remoteDesktop.lockedRequiresUnattended';
      return window.desktopTest.captureAttempts;
    });
    await visibleGuidance(page, locked);
    await page.waitForTimeout(2500);
    expect(await page.evaluate(() => window.desktopTest.captureAttempts)).toBe(attempts);
    await visibleGuidance(page, locked);
  });

  test(`explains privacy prerequisites while keeping ordinary video in ${desktop ? 'desktop' : 'web'}`,
    async ({ page }, info) => {
      await open(page, desktop, 'privacy&privacy-unattended');
      await expect.poll(() => page.locator('video').evaluate(video => video.videoWidth)).toBeGreaterThan(0);
      await page.getByRole('button', { name: '安全选项', exact: true }).click();
      const enable = page.getByRole('button', { name: '启用', exact: true });
      await enable.click();
      await visibleGuidance(page, privacy);
      await expect(enable).toHaveAttribute('aria-pressed', 'false');
      const before = await page.evaluate(() => ({ frames: window.desktopTest.frames,
        attempts: window.desktopTest.captureAttempts, closed: window.desktopTest.closed }));
      await expect.poll(() => page.evaluate(() => window.desktopTest.frames)).toBeGreaterThan(before.frames);
      expect(await page.evaluate(() => window.desktopTest.captureAttempts)).toBe(before.attempts);
      expect(await page.evaluate(() => window.desktopTest.closed)).toBe(before.closed);
      await page.screenshot({ path: info.outputPath('privacy-unattended.png') });
    });
}
