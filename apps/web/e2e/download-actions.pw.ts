import { clickDownloadAction } from './download-test-actions';
import { expect, test, type Page } from '@playwright/test';

const card = (page: Page) => page.getByRole('article', { name: 'sample.md', exact: true });
async function enqueue(page: Page) {
  await page.getByRole('button', { name: '当前项目', exact: true }).click();
  await page.getByRole('button', { name: '下载：sample.md', exact: true }).click();
  await page.getByRole('button', { name: '下载列表', exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('e2e/downloads-harness.html');
  await page.evaluate(() => { window.downloadFixture.size = 512; window.downloadFixture.delay = 0; });
});

test('automatically retries exactly five times and a manual resume starts a fresh run', async ({ page }) => {
  await page.clock.install();
  await page.evaluate(() => { window.downloadFixture.openFailures = 6; });
  await enqueue(page);
  for (const [index, delay] of [1000, 2000, 4000, 8000, 16000].entries()) {
    await expect(card(page)).toContainText('正在重试');
    await page.clock.runFor(delay);
    await expect.poll(() => page.evaluate(() => window.downloadFixture.opens)).toBe(index + 2);
  }
  await expect(card(page)).toContainText('下载失败');
  await page.clock.runFor(60_000);
  expect(await page.evaluate(() => window.downloadFixture.opens)).toBe(6);
  await card(page).getByRole('button', { name: /^(继续下载|重试)$/ }).click();
  await page.clock.runFor(1000);
  await expect(card(page)).toContainText('文件已就绪');
  expect(await page.evaluate(() => window.downloadFixture.opens)).toBe(7);
});

test('opens verified cached text offline without executing HTML and keeps Save available', async ({ page }, info) => {
  const content = '<script>document.body.textContent="unsafe"</script>\nDownloaded document';
  await page.evaluate(content => Object.assign(window.downloadFixture,
    { textContent: content, size: content.length, mimeType: 'text/html' }), content);
  await enqueue(page);
  await expect(card(page)).toContainText('文件已就绪');
  await page.getByRole('button', { name: '断开电脑', exact: true }).click();
  const opened = page.waitForEvent('popup');
  await card(page).getByRole('button', { name: '打开', exact: true }).click();
  const popup = await opened;
  await expect(popup.locator('body')).toContainText(content);
  expect(await popup.evaluate(() => window.opener)).toBeNull();
  await expect(card(page).getByRole('button', { name: '保存到设备' })).toBeEnabled();
  expect(await page.evaluate(() => window.downloadFixture.opens)).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `../../.codex-tmp/download-actions-${info.project.name}.png` });
  await popup.close();
});

test('a blocked popup leaves the file ready and shows an actionable message', async ({ page }) => {
  await enqueue(page);
  await expect(card(page)).toContainText('文件已就绪');
  await page.evaluate(() => { window.open = () => null; });
  await card(page).getByRole('button', { name: '打开', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('允许弹出窗口');
  await expect(card(page)).toContainText('文件已就绪');
});

test('missing cached bytes cannot be opened or marked as saved', async ({ page }) => {
  const firstCompletion = Date.UTC(2026, 9, 25, 6, 0, 0);
  await page.clock.setFixedTime(firstCompletion);
  await page.evaluate(() => { window.downloadFixture.bulk = true; });
  await enqueue(page);
  await expect(card(page)).toContainText('文件已就绪');
  expect((await page.evaluate(async () => (await window.downloadFixture.saved())[0])).completedAt).toBe(firstCompletion);
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('codex-switch.web.downloads.v1', 2);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const tx = request.result.transaction('chunks', 'readwrite');
      tx.objectStore('chunks').clear();
      tx.oncomplete = () => { request.result.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  }));
  await card(page).getByRole('button', { name: '打开', exact: true }).click();
  await expect(card(page)).toContainText('下载失败');
  await expect(card(page).getByRole('button', { name: '打开', exact: true })).toHaveCount(0);
  await expect(card(page)).not.toContainText('已保存到设备');
  await expect(card(page).locator('.download-completion')).toHaveCount(0);
  const recoveredAt = firstCompletion + 65_000;
  await page.clock.setFixedTime(recoveredAt);
  await card(page).getByRole('button', { name: /^(继续下载|重试)$/, exact: true }).click();
  await expect(card(page)).toContainText('文件已就绪');
  expect((await page.evaluate(async () => (await window.downloadFixture.saved())[0])).completedAt).toBe(recoveredAt);
  await expect(card(page).locator('.download-completion')).toContainText('用时1分5秒');
});

test('selects cards, cancels confirmation and deletes only selected downloads offline', async ({ page }, info) => {
  await page.getByRole('button', { name: '当前项目', exact: true }).click();
  for (const name of ['sample.md', 'sample.bin', 'empty.txt']) {
    await page.getByRole('button', { name: `下载：${name}`, exact: true }).click();
  }
  await page.getByRole('button', { name: '下载列表', exact: true }).click();
  if (info.project.name === 'desktop') await page.getByRole('button', { name: '批量管理', exact: true }).click();
  const batch = page.getByRole('button', { name: /^批量删除/ });
  const first = card(page);
  const second = page.getByRole('article', { name: 'sample.bin', exact: true });
  await expect(batch).toBeDisabled();
  await expect(first).toContainText('文件已就绪');
  await first.locator('strong').click();
  await expect(first.getByRole('checkbox')).toBeChecked();
  await page.getByRole('button', { name: '全选', exact: true }).click();
  await expect(batch).toHaveText('批量删除（3）');
  await expect(page.getByRole('article').getByRole('checkbox', { checked: true })).toHaveCount(3);
  await page.getByRole('button', { name: '取消全选', exact: true }).click();
  await expect(page.getByRole('checkbox', { checked: true })).toHaveCount(0);
  await first.locator('strong').click();
  await first.locator('strong').click();
  await expect(batch).toBeDisabled();
  await first.getByRole('checkbox').focus();
  await page.keyboard.press('Space');
  await second.locator('strong').click();
  await expect(batch).toHaveText('批量删除（2）');
  await clickDownloadAction(page, first, '删除');
  await page.getByRole('button', { name: '保留', exact: true }).click();
  await expect(first.getByRole('checkbox')).toBeChecked();
  await batch.click();
  await expect(page.getByText('删除这 2 项下载？')).toBeVisible();
  await page.getByRole('button', { name: '保留', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(3);
  await page.getByRole('button', { name: '断开电脑', exact: true }).click();
  await page.screenshot({ path: `../../.codex-tmp/download-selection-${info.project.name}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await batch.click();
  await page.getByRole('dialog').getByRole('button', { name: '删除', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(batch).toBeDisabled();
  await page.reload();
  await expect(page.getByRole('article')).toHaveCount(1);
  if (info.project.name === 'desktop') await page.getByRole('button', { name: '批量管理', exact: true }).click();
  await expect(page.getByRole('article')).toHaveAttribute('aria-label', 'empty.txt');
  await page.getByRole('button', { name: '全选', exact: true }).click();
  await batch.click();
  await page.getByRole('dialog').getByRole('button', { name: '删除', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '全选', exact: true })).toBeDisabled();
});

test('keeps selection and wraps translated controls when switching languages offline', async ({ page }) => {
  await enqueue(page);
  await expect(card(page)).toContainText('文件已就绪');
  await card(page).locator('strong').click();
  await page.context().setOffline(true);
  const cases = [
    ['en', 'Delete selected (1)', 'Select all', 'Deselect all'],
    ['ru', 'Удалить выбранное (1)', 'Выбрать всё', 'Снять выделение'],
    ['ja', '選択した項目を削除（1）', 'すべて選択', '選択を解除'],
    ['zh', '批量删除（1）', '全选', '取消全选'],
  ] as const;
  for (const [language, label, selectAll, deselectAll] of cases) {
    await page.evaluate(language => window.downloadFixture.setLanguage(language), language);
    await expect(page.getByRole('button', { name: label, exact: true })).toBeEnabled();
    await expect(card(page).getByRole('checkbox')).toBeChecked();
    await page.getByRole('button', { name: deselectAll, exact: true }).click();
    await expect(card(page).getByRole('checkbox')).not.toBeChecked();
    await page.getByRole('button', { name: selectAll, exact: true }).click();
    await expect(card(page).getByRole('checkbox')).toBeChecked();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('retains completion time and total elapsed duration through pauses, reloads and repeated saves',
  async ({ page }, info) => {
    const startedAt = Date.UTC(2026, 9, 25, 6, 0, 0);
    const completedAt = startedAt + 65_000;
    await page.clock.setFixedTime(startedAt);
    await page.evaluate(() => { window.downloadFixture.delay = 1000; });
    await enqueue(page);
    await expect(card(page)).toContainText('下载中');
    await expect(card(page).locator('.download-completion')).toHaveCount(0);
    await clickDownloadAction(page, card(page), '暂停');
    await expect(card(page)).toContainText('已暂停');
    await page.clock.setFixedTime(completedAt);
    await card(page).getByRole('button', { name: /^(继续下载|重试)$/, exact: true }).click();
    await expect(card(page)).toContainText('文件已就绪');
    const details = card(page).locator('.download-completion');
    await expect(details).toContainText('2026/10/25');
    await expect(details).toContainText(' · 用时1分5秒');
    const saved = await page.evaluate(async () => (await window.downloadFixture.saved())[0]);
    expect(saved).toMatchObject({ createdAt: startedAt, completedAt });
    const before = await details.innerText();
    await page.reload();
    await expect(details).toHaveText(before);
    await page.evaluate(() => Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true, value: async () => ({ createWritable: async () => ({
        write: async () => {}, close: async () => {}, abort: async () => {},
      }) }),
    }));
    for (const elapsed of [60_000, 120_000]) {
      await page.clock.setFixedTime(completedAt + elapsed);
      await card(page).getByRole('button', { name: '保存到设备', exact: true }).click();
      await expect(card(page)).toContainText('已完成');
      await expect(card(page)).not.toContainText('已保存到设备');
      expect((await page.evaluate(async () => (await window.downloadFixture.saved())[0])).completedAt).toBe(completedAt);
      await expect(details).toHaveText(before);
    }
    await page.screenshot({ path: info.outputPath('download-completion.png'), fullPage: true });
    await page.evaluate(() => document.documentElement.style.setProperty('--app-font-scale', '1.3'));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await details.evaluate(element => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return range.getClientRects().length;
    })).toBe(1);
    await page.screenshot({ path: info.outputPath('download-completion-large-font.png'), fullPage: true });
  });

test('keeps save warnings visible alongside download completion details', async ({ page }) => {
  await enqueue(page);
  await expect(card(page)).toContainText('文件已就绪');
  const download = page.waitForEvent('download');
  await card(page).getByRole('button', { name: '保存到设备', exact: true }).click();
  await download;
  await expect(card(page)).toContainText('已开始保存，请在浏览器下载列表中确认。');
  await expect(card(page).locator('.download-completion')).toContainText(' · 用时');
  await page.evaluate(() => Object.defineProperty(window, 'showSaveFilePicker', {
    configurable: true, value: async () => { throw new DOMException('Denied', 'NotAllowedError'); },
  }));
  await card(page).getByRole('button', { name: '保存到设备', exact: true }).click();
  await expect(card(page)).toContainText('保存未完成，文件仍已就绪，可再次保存。');
  await expect(card(page).locator('.download-completion')).toContainText(' · 用时');
});

test('hides unrecorded timing for old completed records without leaving an empty row', async ({ page }) => {
  await enqueue(page);
  await expect(card(page)).toContainText('文件已就绪');
  await page.evaluate(async () => {
    const [task] = await window.downloadFixture.saved();
    delete task.completedAt;
    task.status = 'completed';
    task.message = '已保存到设备';
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('codex-switch.web.downloads.v1', 2);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const transaction = request.result.transaction('tasks', 'readwrite');
        transaction.objectStore('tasks').put(task);
        transaction.oncomplete = () => { request.result.close(); resolve(); };
        transaction.onerror = () => reject(transaction.error);
      };
    });
  });
  await page.reload();
  await expect(card(page).locator('.download-completion')).toHaveCount(0);
  await expect(card(page)).not.toContainText('未记录');
  await expect(card(page)).not.toContainText('已保存到设备');
  expect((await page.evaluate(async () => (await window.downloadFixture.saved())[0])).completedAt).toBeUndefined();
});
