import { expect, test, type Page } from '@playwright/test';

const position = (page: Page) => page.locator('.cs-image-stage img').evaluate(image => {
  const transform = new DOMMatrixReadOnly(getComputedStyle(image).transform);
  return { x: Math.round(transform.m41), y: Math.round(transform.m42) };
});

async function drag(page: Page, start: { x: number; y: number }, end: { x: number; y: number }) {
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 40 });
  await page.mouse.up();
}

for (const mode of ['local', 'remote', 'web']) {
  for (const linked of [false, true]) {
    test(`${mode} preview follows long drags${linked ? ' inside a linked image' : ''}`, async ({ page }, info) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.route('https://fonts.googleapis.com/**', route => route.abort());
      await page.goto(`/e2e/image-viewer-drag-harness.html?mode=${mode}${linked ? '&linked' : ''}`);
      await page.getByRole('button', { name: '放大查看：拖动测试', exact: true }).click();
      await expect(page.locator('.cs-image-stage img')).toBeVisible();
      await expect(page.locator('.cs-image-viewer')).toHaveCSS('user-select', 'none');
      await expect(page.getByRole('button', { name: '关闭图片', exact: true })).toHaveCSS('user-select', 'none');
      await expect(page.locator('.cs-image-toolbar')).toHaveCSS('user-select', 'none');
      await drag(page, { x: 300, y: 200 }, { x: 900, y: 500 });
      await expect.poll(() => position(page)).toEqual({ x: 600, y: 300 });
      // Cross the toolbar while held: pointer capture must keep the image moving.
      await drag(page, { x: 900, y: 500 }, { x: 640, y: 790 });
      await expect.poll(() => position(page)).toEqual({ x: 340, y: 590 });
      await page.getByRole('button', { name: '还原图片', exact: true }).click();
      await page.getByRole('button', { name: '放大图片', exact: true }).click();
      await page.getByRole('button', { name: '旋转图片', exact: true }).click();
      await drag(page, { x: 640, y: 300 }, { x: 200, y: 150 });
      await expect.poll(() => position(page)).toEqual({ x: -440, y: -150 });
      await expect(page.getByRole('button', { name: '还原图片', exact: true })).toHaveText('150%');
      await page.screenshot({ path: info.outputPath(`${mode}-drag.png`) });
      await page.locator('.cs-image-stage').dblclick({ position: { x: 500, y: 300 } });
      await expect.poll(() => position(page)).toEqual({ x: 0, y: 0 });
      await expect(page.getByRole('button', { name: '还原图片', exact: true })).toHaveText('100%');
      await page.keyboard.press('Escape');
      await expect(page.locator('.cs-image-viewer')).toHaveCount(0);
    });
  }
}
