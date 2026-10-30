import { expect, test, type Page } from '@playwright/test';
import type { desktopTest } from './remote-desktop-fixture';

declare global { interface Window { desktopTest: typeof desktopTest } }

test.beforeEach(({ isMobile }) => { test.skip(!!isMobile, 'Computer switching uses the PC launcher.'); });

const visibleDesktop = (page: Page) => page.getByRole('dialog', { name: '远程桌面', exact: true });
const restore = (page: Page) => page.getByRole('button', { name: '恢复远程桌面', exact: true });
const minimize = (page: Page) => page.getByRole('button', { name: '最小化', exact: true }).click();

async function openDesktop(page: Page) {
  await page.getByRole('button', { name: '打开远程桌面', exact: true }).click();
  await expect.poll(() => visibleDesktop(page).locator('video').evaluate(video => video.videoWidth)).toBeGreaterThan(0);
  await expect(visibleDesktop(page).getByText('正在连接桌面…', { exact: true })).not.toBeVisible();
  return visibleDesktop(page).locator('video').elementHandle();
}

async function expectSessions(page: Page, captures: number, closed: number) {
  await expect.poll(() => page.evaluate(() => ({
    captures: window.desktopTest.captures, closed: window.desktopTest.closed,
  }))).toEqual({ captures, closed });
}

for (const native of [false, true]) {
  test.describe(native ? 'desktop client' : 'PC browser', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`e2e/remote-desktop-harness.html?computers${native ? '&native-clipboard' : ''}`);
    });

    test('retains independent desktops across remote and local switches until explicitly closed', async ({ page }) => {
      const office = await openDesktop(page);
      await minimize(page);
      await page.locator('#select-home').click();
      const home = await openDesktop(page);
      await minimize(page);
      await page.locator('#select-local').click();
      await expect(page.locator('.rd-root')).toHaveCount(2);
      await expect(visibleDesktop(page)).toHaveCount(0);
      await expect(restore(page)).toHaveCount(0);
      const before = await page.evaluate(() => ({ frames: window.desktopTest.frames,
        inputs: window.desktopTest.inputs.length }));
      await page.getByRole('textbox', { name: '本机聊天消息' }).fill('local chat');
      await expect.poll(() => page.evaluate(() => window.desktopTest.frames)).toBeGreaterThan(before.frames);
      expect(await page.evaluate(() => window.desktopTest.inputs.length)).toBe(before.inputs);
      await expectSessions(page, 2, 0);
      for (const id of ['office', 'home', 'office']) {
        await page.locator(`#select-${id}`).click();
        await expect(visibleDesktop(page)).toHaveCount(0);
        await expect(restore(page).getByRole('status', { name: '正在后台运行' })).toBeVisible();
        await restore(page).click();
        const video = id === 'office' ? office : home;
        expect(await video!.evaluate(element => element === document.querySelector('.rd-root:not([hidden]) video')))
          .toBe(true);
        await page.keyboard.press('a');
        await expect.poll(() => page.evaluate(() => window.desktopTest.inputs.at(-1)))
          .toMatchObject({ kind: 'keyboard', code: 'KeyA', down: false });
        await minimize(page);
      }
      await expectSessions(page, 2, 0);
      await restore(page).click();
      await page.getByRole('button', { name: '关闭', exact: true }).click();
      await expectSessions(page, 2, 1);
      await page.locator('#select-home').click();
      await restore(page).click();
      expect(await home!.evaluate(element => element === document.querySelector('.rd-root:not([hidden]) video')))
        .toBe(true);
      await minimize(page);
      await page.locator('#sign-out').click();
      await expectSessions(page, 2, 2);
      await expect(page.locator('.rd-root')).toHaveCount(0);
    });

    test('hides an open viewer on navigation and restores its existing video and input focus', async ({ page }) => {
      const video = await openDesktop(page);
      // App navigation can also come from notifications while the viewer is open.
      await page.locator('#select-local').evaluate(button => (button as HTMLButtonElement).click());
      await expect(visibleDesktop(page)).toHaveCount(0);
      await expect(page.locator('.rd-root')).toHaveCount(1);
      await page.getByRole('textbox', { name: '本机聊天消息' }).fill('local message');
      await page.locator('#select-office').click();
      await expect(visibleDesktop(page)).toBeVisible();
      await expect(visibleDesktop(page).locator('.rd-key-capture')).toBeFocused();
      expect(await video!.evaluate(element => element === document.querySelector('video'))).toBe(true);
      await expectSessions(page, 1, 0);
      await minimize(page);
      await page.locator('#sign-out').click();
      await expectSessions(page, 1, 1);
    });
  });
}
