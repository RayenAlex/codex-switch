import { expect, test } from '@playwright/test';

const CAPACITY_MESSAGE = '当前模型繁忙，请换个模型重试。';
const surfaces = [
  { name: 'local', query: '' },
  { name: 'remote', query: '&remote&desktop' },
  { name: 'web', query: '&remote' },
];

for (const { name, query } of surfaces) {
  for (const width of [390, 1280]) {
    test(`capacity errors are visible inline on ${name} at ${width}px`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/e2e/turn-retry-harness.html?capacity${query}`);
      const message = page.getByText(CAPACITY_MESSAGE, { exact: true });
      await expect(message).toBeVisible();
      await expect(page.getByText('查看报错详情', { exact: true })).toHaveCount(0);
      await expect(page.getByText('本次回复遇到问题，已中断。', { exact: true })).toHaveCount(0);
      expect((await message.boundingBox())!.width).toBeLessThanOrEqual(400);
      expect(await message.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const retry = page.getByRole('button', { name: '重试', exact: true });
      await expect(retry).toHaveCount(1);
      await expect(retry).toBeEnabled();
      const card = message.locator('../..');
      await expect(card.getByRole('button', { name: '重试', exact: true })).toBeVisible();
      await expect(card).toHaveCSS('border-top-style', 'solid');
      await expect(card).not.toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0)');
      await page.screenshot({ path: info.outputPath('capacity-error.png') });
      await page.getByLabel('暂不可用').check();
      await expect(retry).toBeDisabled();
      await page.getByLabel('暂不可用').uncheck();
      await retry.click();
      await expect(page.getByRole('button', { name: '正在重试…', exact: true })).toBeDisabled();
      await expect(retry).toBeEnabled();
      await retry.click();
      await expect(page.getByText('已继续检查项目。')).toBeVisible();
      await expect(retry).toHaveCount(0);
      await expect(message).toBeVisible();
    });
  }
}
