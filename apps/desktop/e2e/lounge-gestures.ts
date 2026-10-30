import { expect, type Locator, type Page } from '@playwright/test';

const LONG_PRESS_WAIT_MS = 650;

export async function expectNoMenuOutsideBubble(page: Page, row: Locator) {
  await row.scrollIntoViewIfNeeded();
  const point = await row.evaluate(element => {
    const row = element.getBoundingClientRect();
    const bubble = element.querySelector('.lounge-bubble')!.getBoundingClientRect();
    const rightGap = row.right - bubble.right;
    const leftGap = bubble.left - row.left;
    return { x: rightGap > leftGap ? row.right - 4 : row.left + 4,
      y: bubble.top + bubble.height / 2 };
  });
  const menu = page.getByRole('menuitem', { name: '引用回复' });
  await page.mouse.click(point.x, point.y, { button: 'right' });
  await expect(menu).toBeHidden();
  const pointer = { pointerId: 9, pointerType: 'touch', button: 0, isPrimary: true,
    clientX: point.x, clientY: point.y };
  await row.dispatchEvent('pointerdown', pointer);
  await page.waitForTimeout(LONG_PRESS_WAIT_MS);
  await expect(menu).toBeHidden();
  await row.dispatchEvent('pointerup', pointer);
  for (const target of [row.locator('.lounge-avatar'), row.locator('.lounge-account')]) {
    // The compact mobile layout omits the current user's avatar and name.
    if (!await target.count()) continue;
    await target.click({ button: 'right' });
    await expect(menu).toBeHidden();
  }
}
