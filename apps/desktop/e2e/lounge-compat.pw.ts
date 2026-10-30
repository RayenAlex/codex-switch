import { expect, test } from '@playwright/test';
import { setupLounge } from './lounge-support';

test.use({ hasTouch: true });

for (const width of [1440, 390]) {
  test(`web ${width}: emoji opens repeatedly and inserts at the caret`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const relay = await setupLounge(page, true);
    await page.goto('http://127.0.0.1:1486/web/'); await relay.ready();
    if (width < 600) {
      await page.locator('.mobile-tabbar').getByText('发现', { exact: true }).click();
      await page.locator('.discovery-lounge').click();
      await page.getByRole('button', { name: '群聊', exact: true }).click();
    } else await page.getByRole('button', { name: '在线交流', exact: true }).click();
    const input = page.getByRole('textbox', { name: '消息', exact: true });
    const trigger = page.getByRole('button', { name: '表情', exact: true });
    await input.fill('AB'); await input.press('ArrowLeft');
    await trigger.click();
    await page.getByRole('button', { name: '😀', exact: true }).click();
    await expect(input).toHaveValue('A😀B');
    await expect(page.locator('.lounge-emoji-picker')).toBeHidden();
    await trigger.click();
    await expect(page.locator('.lounge-emoji-picker')).toBeVisible();
    await input.click();
    await expect(page.locator('.lounge-emoji-picker')).toBeHidden();
    await trigger.focus(); await trigger.press('Enter');
    await expect(page.locator('.lounge-emoji-picker')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.lounge-emoji-picker')).toBeHidden();
    await trigger.tap();
    await page.getByRole('button', { name: '😀', exact: true }).tap();
    await expect(page.locator('.lounge-emoji-picker')).toBeHidden();
  });
}
