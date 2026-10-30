import { expect, test } from '@playwright/test';
import type {} from './download-manager-harness';

// A cold Vite start loads both desktop and shared web modules for this harness.
test.setTimeout(90_000);

test.beforeEach(async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
});

test('PC workspace groups local and remote tasks, searches, sorts and scopes batch selection', async ({ page }) => {
  await page.setViewportSize({ width: 1674, height: 940 });
  await page.goto('/e2e/download-manager-harness.html?collapsed', { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    window.desktopDownloads.delay = 10;
    await window.desktopDownloads.addLocal('review-notes.md');
    await window.desktopDownloads.addRemote('RemoteAI_2.0.22_windows-x64.msi');
    await window.desktopDownloads.addRemote('RemoteAI_2.0.12_windows-x64.msi');
  });
  await page.getByRole('navigation').getByRole('button', { name: '下载管理', exact: true }).click();
  await expect(page.locator('.dw-ready-row')).toHaveCount(3);
  await page.evaluate(async () => {
    window.desktopDownloads.delay = 10_000;
    await window.desktopDownloads.addLocal('project.zip');
    await window.desktopDownloads.addRemote('resources.zip');
  });
  await expect(page.locator('.dw-active-card')).toHaveCount(2);
  const active = page.locator('.dw-active-card');
  const first = (await active.nth(0).boundingBox())!;
  const second = (await active.nth(1).boundingBox())!;
  expect(first.y).toBe(second.y);
  expect(first.x + first.width).toBeLessThan(second.x);
  await expect(page.getByRole('button', { name: '全部 5', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: '../../.codex-tmp/download-workspace-desktop.png', fullPage: true });
  const search = page.getByRole('searchbox');
  await search.fill('ZIP');
  await expect(page.getByRole('article')).toHaveCount(2);
  await page.getByRole('button', { name: '已就绪 3', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(0);
  await expect(page.getByText('没有找到匹配的文件，请换个名称试试。')).toBeVisible();
  await page.getByRole('button', { name: '查看全部任务', exact: true }).click();
  await page.getByRole('combobox', { name: '排序方式' }).selectOption('name');
  await expect(page.locator('.dw-ready-row strong')).toHaveText([
    'RemoteAI_2.0.12_windows-x64.msi', 'RemoteAI_2.0.22_windows-x64.msi', 'review-notes.md',
  ]);
  await page.getByRole('checkbox', { name: '全选', exact: true }).check();
  await expect(page.getByRole('button', { name: '批量删除（3）', exact: true })).toBeEnabled();
  await expect(active.getByRole('checkbox', { checked: true })).toHaveCount(0);
  await page.getByRole('button', { name: '未完成 2', exact: true }).click();
  await expect(page.getByRole('button', { name: '批量删除', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '完成管理', exact: true }).click();
  await expect(active.getByRole('checkbox')).toHaveCount(0);
  await page.setViewportSize({ width: 1000, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '../../.codex-tmp/download-workspace-desktop-narrow.png', fullPage: true });
});

test('PC workspace remains readable offline in every released language and dark mode', async ({ page }) => {
  await page.goto('/e2e/download-manager-harness.html?collapsed&dark', { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => { window.desktopDownloads.delay = 10; await window.desktopDownloads.addLocal(); });
  await page.getByRole('navigation').getByRole('button', { name: '下载管理', exact: true }).click();
  await expect(page.locator('.dw-ready-row')).toHaveCount(1);
  await page.context().setOffline(true);
  for (const language of ['en', 'ru', 'ja', 'zh'] as const) {
    await page.evaluate(value => window.desktopDownloads.setLanguage(value), language);
    await expect(page.getByRole('searchbox')).toBeVisible();
    await expect(page.getByRole('combobox')).toBeVisible();
    expect(await page.locator('.download-workspace').innerText()).not.toContain('client.downloads.');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `../../.codex-tmp/download-workspace-dark-${language}.png`, fullPage: true });
  }
});
