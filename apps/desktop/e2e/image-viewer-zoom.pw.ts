import { expect, test, type Page } from '@playwright/test';

async function zoom(page: Page, method: 'wheel' | 'buttons', direction: 'in' | 'out', steps: number) {
  const label = direction === 'in' ? '放大图片' : '缩小图片';
  for (let step = 0; step < steps; step++) {
    if (method === 'buttons') await page.getByRole('button', { name: label, exact: true }).click();
    else await page.mouse.wheel(0, direction === 'in' ? -100 : 100);
  }
}

async function expectContinuousDrag(page: Page) {
  const image = page.locator('.cs-image-stage img');
  const position = () => image.evaluate(element => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
    return { x: Math.round(matrix.m41), y: Math.round(matrix.m42) };
  });
  const start = await position();
  await page.mouse.move(300, 220);
  await page.mouse.down();
  for (let segment = 1; segment <= 4; segment++) {
    await page.mouse.move(300 + segment * 120, 220 + segment * 60, { steps: 8 });
    await expect.poll(position).toEqual({ x: start.x + segment * 120, y: start.y + segment * 60 });
  }
  await page.mouse.up();
}

for (const mode of ['local', 'remote', 'web']) {
  for (const method of ['wheel', 'buttons'] as const) {
    test(`${mode}: drag after zooming in then out with ${method}`, async ({ page }, info) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.route('https://fonts.googleapis.com/**', route => route.abort());
      await page.goto(`/e2e/image-viewer-drag-harness.html?mode=${mode}&large`);
      await page.getByRole('button', { name: '放大查看：拖动测试', exact: true }).click();
      const original = page.getByRole('button', { name: '查看原图', exact: true });
      if (mode === 'local') await expect(original).toHaveCount(0);
      else await original.click();
      const conversation = page.getByTestId('conversation');
      const initialScroll = await conversation.evaluate(element => element.scrollTop);
      const percentage = page.getByRole('button', { name: '还原图片', exact: true });
      await page.mouse.move(600, 300);
      await zoom(page, method, 'in', 5);
      await expect(percentage).toHaveText(method === 'wheel' ? '249%' : '759%');
      await expectContinuousDrag(page);
      await zoom(page, method, 'out', 5);
      await expect(percentage).toHaveText('100%');
      await expectContinuousDrag(page);
      await zoom(page, method, 'out', 2);
      await expect(percentage).toHaveText(method === 'wheel' ? '69%' : '50%');
      await expectContinuousDrag(page);
      await percentage.hover();
      await page.mouse.wheel(0, 100);
      await expect(percentage).toHaveText(method === 'wheel' ? '69%' : '50%');
      // Zoom must stay inside the modal instead of reaching conversation history handlers.
      await expect(conversation).toHaveAttribute('data-wheel-events', '0');
      expect(await conversation.evaluate(element => element.scrollTop)).toBe(initialScroll);
      await page.screenshot({ path: info.outputPath(`${mode}-${method}-zoom-out-drag.png`) });
    });
  }
}
