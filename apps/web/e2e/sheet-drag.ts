import { expect, type Locator, type Page } from '@playwright/test';

export async function dragSheet(page: Page, distance: number, options: {
  cancel?: boolean; target?: Locator; follows?: boolean;
} = {}) {
  const handle = options.target ?? page.locator('.sheet-drag-handle').last();
  const body = page.locator('.mobile-popup').last();
  const box = (await handle.boundingBox())!;
  const start = { x: box.x + box.width / 2, y: box.y + 10 };
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
    for (let step = 1; step <= 6; step++) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove',
        touchPoints: [{ x: start.x, y: start.y + distance * step / 6 }] });
    }
    await expect(body).toHaveCSS('translate', distance > 0 && options.follows !== false ? `0px ${distance}px` : '0px');
    // Release after a pause so short drags exercise distance, independently of flick speed.
    await page.waitForTimeout(150);
    await session.send('Input.dispatchTouchEvent', {
      type: options.cancel ? 'touchCancel' : 'touchEnd', touchPoints: [],
    });
  } finally { await session.detach(); }
}
