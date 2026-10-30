import { expect, test } from '@playwright/test';
import type {} from './downloads-harness';

test('only PC widths show the new workspace and filtering keeps mobile downloads intact', async ({ page }, info) => {
  await page.goto('e2e/downloads-harness.html');
  await page.evaluate(() => { window.downloadFixture.delay = 0; window.downloadFixture.size = 512; });
  await page.getByRole('button', { name: '当前项目', exact: true }).click();
  for (const name of ['sample.md', 'sample.bin', 'empty.txt']) {
    await page.getByRole('button', { name: `下载：${name}`, exact: true }).click();
  }
  await page.getByRole('button', { name: '下载列表', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(3);
  if (info.project.name === 'mobile') {
    await expect(page.locator('.download-workspace')).toHaveCount(0);
    await expect(page.locator('.download-card.is-selectable')).toHaveCount(3);
    await page.screenshot({ path: '../../.codex-tmp/download-workspace-mobile-unchanged.png', fullPage: true });
    return;
  }
  await expect(page.locator('.dw-ready-row')).toHaveCount(3);
  await page.getByRole('searchbox').fill('sample.MD');
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.getByRole('checkbox', { name: '全选', exact: true }).check();
  await expect(page.getByRole('button', { name: '批量删除（1）', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '清除搜索', exact: true }).click();
  await expect(page.getByRole('button', { name: '批量删除', exact: true })).toBeDisabled();
  await page.getByRole('combobox').selectOption('size');
  await expect(page.locator('.dw-ready-row').last()).toHaveAttribute('aria-label', 'empty.txt');
  await page.getByRole('button', { name: '完成管理', exact: true }).click();
  await page.screenshot({ path: '../../.codex-tmp/download-workspace-web.png', fullPage: true });
  await page.setViewportSize({ width: 860, height: 900 });
  await expect(page.locator('.download-workspace')).toHaveCount(0);
  await expect(page.getByRole('article')).toHaveCount(3);
  await page.setViewportSize({ width: 861, height: 900 });
  await expect(page.locator('.dw-ready-row')).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('PC retry status shows the real attempt and allows immediate retry', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  await page.goto('e2e/downloads-harness.html');
  await page.clock.install();
  await page.evaluate(() => {
    window.downloadFixture.openFailures = 1; window.downloadFixture.size = 512; window.downloadFixture.delay = 0;
  });
  await page.getByRole('button', { name: '当前项目', exact: true }).click();
  await page.getByRole('button', { name: '下载：sample.md', exact: true }).click();
  await page.getByRole('button', { name: '下载列表', exact: true }).click();
  const task = page.getByRole('article', { name: 'sample.md', exact: true });
  await expect(task).toContainText('等待重试');
  await expect(task).toContainText('自动重试 1 / 5');
  await task.getByRole('button', { name: '重试', exact: true }).click();
  await page.clock.runFor(50);
  await expect(task).toContainText('文件已就绪');
  expect(await page.evaluate(() => window.downloadFixture.opens)).toBe(2);
});
