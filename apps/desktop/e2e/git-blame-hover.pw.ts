import { expect, test, type Locator, type Page } from '@playwright/test';

test.describe.configure({ timeout: 90_000 });

async function showDetails(page: Page, labels: Locator, index: number) {
  await labels.nth(index).hover();
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toHaveCount(1);
  await expect(tooltip).toContainText(await labels.nth(index).innerText());
  const bounds = (await tooltip.boundingBox())!;
  expect(bounds.width).toBeLessThanOrEqual(400);
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(page.viewportSize()!.height);
}

for (const mode of ['local', 'remote', 'web']) {
  for (const theme of ['light', 'dark']) {
    test(`${mode} ${theme}: blame hover closes and green shades show absolute commit age`, async ({ page }, info) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.clock.setFixedTime(new Date('2026-10-28T00:00:00Z'));
      await page.goto(`/e2e/project-browser-theme-harness.html?mode=${mode}${theme === 'dark' ? '&dark' : ''}`);
      await page.evaluate(() => {
        document.body.dataset.blameAges = '1,30,120,365';
        localStorage.setItem('codex-switch.project-browser.auto-save', '0');
      });
      await page.getByRole('button', { name: '文件浏览', exact: true }).click();
      await page.getByRole('treeitem', { name: 'notes.txt', exact: true }).click();
      const editor = page.getByRole('tabpanel', { name: 'notes.txt', exact: true });
      const toggle = editor.getByRole('button', { name: '显示 Git Blame', exact: true });
      await toggle.click();
      const labels = editor.locator('.pf-blame-label');
      await expect(labels).toHaveCount(6);
      const colors = await labels.evaluateAll(elements => elements.slice(0, 4).map(element =>
        getComputedStyle(element).backgroundColor.match(/[\d.]+/g)!.map(Number)));
      for (const [red, green, blue, opacity] of colors) {
        expect(green).toBeGreaterThan(Math.max(red, blue));
        expect(opacity).toBeGreaterThan(0);
      }
      expect(colors[0][3]).toBeGreaterThan(colors[1][3]);
      expect(colors[1][3]).toBeGreaterThan(colors[2][3]);
      expect(colors[2][3]).toBeGreaterThan(colors[3][3]);
      for (const index of [0, 3, 1, 4, 2, 0]) await showDetails(page, labels, index);
      await page.locator('.pf-browser').screenshot({ path: info.outputPath(`blame-${mode}-${theme}.png`) });
      await editor.locator('.cm-content').hover();
      await expect(page.getByRole('tooltip')).toHaveCount(0);
      await showDetails(page, labels, 1);
      await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      await expect(page.getByRole('tooltip')).toHaveCount(0);
      await showDetails(page, labels, 2);
      await page.keyboard.press('ArrowRight');
      await expect(page.getByRole('tooltip')).toHaveCount(0);
      await showDetails(page, labels, 3);
      await page.getByRole('treeitem', { name: 'settings.json', exact: true }).click();
      await expect(page.getByRole('tooltip')).toHaveCount(0);
      await page.getByRole('tab', { name: 'notes.txt', exact: true }).click();
      await showDetails(page, labels, 0);
      await toggle.click();
      await expect(editor.locator('.pf-blame-tooltip')).toHaveCount(0);
      await toggle.click();
      await showDetails(page, labels, 1);
      await editor.getByRole('button', { name: '全屏浏览', exact: true }).click();
      await showDetails(page, labels, 2);
      await page.mouse.move(0, 0);
      await expect(page.getByRole('tooltip')).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  }
}
