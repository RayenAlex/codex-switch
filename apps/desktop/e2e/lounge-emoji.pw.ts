import { expect, test } from '@playwright/test';
import { setupLounge } from './lounge-support';

test.use({ hasTouch: true, isMobile: true });

for (const width of [320, 390]) {
  for (const theme of ['light', 'dark']) {
    test(`mobile emoji ${width} ${theme}: dock, selection, repeated insertion and keyboard switching`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      const relay = await setupLounge(page, true);
      await page.goto('http://127.0.0.1:1486/web/'); await relay.ready();
      await page.evaluate(value => document.documentElement.dataset.theme = value, theme);
      await page.locator('.mobile-tabbar').getByText('发现', { exact: true }).tap();
      await page.locator('.discovery-lounge').tap();
      await page.getByRole('button', { name: '群聊', exact: true }).click();
      const input = page.getByRole('textbox', { name: '消息', exact: true });
      const toggle = page.getByRole('button', { name: '表情', exact: true });
      const panel = page.getByRole('group', { name: '表情', exact: true });
      await input.fill('你好世界');
      await input.evaluate(node => { node.setSelectionRange(1, 3); node.dispatchEvent(new Event('select', { bubbles: true })); });
      await toggle.tap();
      await expect(input).not.toBeFocused();
      await expect(panel).toBeVisible();
      const panelBox = (await panel.boundingBox())!;
      const inputBox = (await input.boundingBox())!;
      expect(panelBox.y).toBeGreaterThanOrEqual(inputBox.y + inputBox.height);
      expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(844);
      expect(panelBox.height).toBeGreaterThanOrEqual(240);
      await panel.getByRole('button', { name: '😀', exact: true }).tap();
      await panel.getByRole('button', { name: '😂', exact: true }).tap();
      await panel.getByRole('button', { name: '❤️', exact: true }).tap();
      await expect(input).toHaveValue('你😀😂❤️界');
      await expect(input).not.toBeFocused();
      await expect(panel).toBeVisible();
      await page.screenshot({ path: `../../.codex-tmp/lounge-emoji-${width}-${theme}.png` });
      await page.getByRole('button', { name: '发送', exact: true }).tap();
      await expect(input).toHaveValue('');
      expect(relay.sent[0].text).toBe('你😀😂❤️界');
      await expect(panel).toBeVisible();
      await panel.getByRole('button', { name: '😊', exact: true }).tap();
      await expect(input).toHaveValue('😊');
      await input.tap();
      await expect(input).toBeFocused();
      await expect(panel).toBeHidden();
      await input.press('End'); await input.pressSequentially('abc');
      await toggle.tap(); await panel.getByRole('button', { name: '😀', exact: true }).tap();
      await expect(input).toHaveValue('😊abc😀');
      await toggle.tap(); await expect(input).toBeFocused(); await expect(panel).toBeHidden();
      await toggle.tap(); await page.keyboard.press('Escape'); await expect(panel).toBeHidden();
      await toggle.tap(); await page.getByRole('button', { name: '添加内容', exact: true }).tap();
      await expect(panel).toBeHidden();
      await expect(page.getByRole('button', { name: '添加图片', exact: true })).toBeVisible();
      await page.locator('.ant-drawer-close:visible').click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }
}

test('mobile emoji reserves the actual keyboard height as the visual viewport expands', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const relay = await setupLounge(page, true);
  await page.goto('http://127.0.0.1:1486/web/'); await relay.ready();
  await page.locator('.mobile-tabbar').getByText('发现', { exact: true }).tap();
  await page.locator('.discovery-lounge').tap();
  await page.getByRole('button', { name: '群聊', exact: true }).click();
  await page.getByRole('textbox', { name: '消息', exact: true }).fill('keyboard');
  const resizeViewport = async (height: number) => page.evaluate(value => {
    Object.defineProperty(window.visualViewport, 'height', { configurable: true, value });
    window.visualViewport!.dispatchEvent(new Event('resize'));
  }, height);
  await resizeViewport(324);
  await page.getByRole('button', { name: '表情', exact: true }).tap();
  const panel = page.getByRole('group', { name: '表情', exact: true });
  expect((await panel.boundingBox())!.height).toBe(0);
  await resizeViewport(844);
  await expect.poll(async () => (await panel.boundingBox())!.height).toBe(520);
  await panel.getByRole('button', { name: '😀', exact: true }).tap();
  await expect(page.getByRole('textbox', { name: '消息', exact: true })).toHaveValue('keyboard😀');
  const send = (await page.getByRole('button', { name: '发送', exact: true }).boundingBox())!;
  expect(send.y).toBeGreaterThan(65);
  expect(send.y + send.height).toBeLessThan(844);
});
