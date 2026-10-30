import { expect, test, type Page } from '@playwright/test';
import { sshEditorFixture } from './ssh-editor-fixture';

async function connect(page: Page, mode: string) {
  await page.setViewportSize({ width: 1440, height: 920 });
  await page.goto(`/e2e/ssh-harness.html?mode=${mode}&cloud=1`);
  await page.getByRole('button', { name: mode === 'web' ? '打开远程终端' : '打开终端', exact: true }).click();
  await page.getByRole('button', { name: '终端连接选项' }).click();
  await page.getByRole('menuitem', { name: 'Editor server', exact: true }).click();
  await page.getByRole('button', { name: '远程文件浏览', exact: true }).click();
  await expect(page.getByRole('treeitem', { name: 'large.bin', exact: true })).toBeVisible();
}

for (const mode of ['local', 'remote', 'web']) {
  test(`${mode}: SSH downloads continue in the manager with progress, pause and verified saved bytes`,
    async ({ page }, info) => {
      test.setTimeout(120_000);
      const fixture = await sshEditorFixture(page);
      const bytes = Buffer.alloc(6 * 1024 * 1024 + 19, 0x5a);
      fixture.files.set('/large.bin', bytes);
      const offsets: number[] = [];
      let slow = true;
      await page.route('http://127.0.0.1:1498/rpc', async route => {
        const request = route.request().postDataJSON().request;
        if (request?.type === 'readChunk' && request.path === '/large.bin') {
          offsets.push(request.offset);
          if (slow) await new Promise(resolve => setTimeout(resolve, 250));
        }
        await route.fallback();
      });
      await connect(page, mode);
      await page.getByRole('treeitem', { name: 'large.bin', exact: true }).click({ button: 'right' });
      await page.getByRole('menuitem', { name: '下载', exact: true }).click();
      await expect(page.getByRole('status').filter({ hasText: '已加入下载管理' })).toBeVisible();
      await page.getByRole('button', { name: '关闭editor.test 远程文件浏览', exact: true }).click();
      await page.getByRole('button', { name: '下载管理', exact: true }).click();
      const task = page.getByRole('article', { name: 'large.bin', exact: true });
      const progress = task.getByRole('progressbar');
      await expect(progress).toBeVisible();
      await expect.poll(async () => Number(await progress.getAttribute('value'))).toBeGreaterThan(0);
      expect(Number(await progress.getAttribute('value'))).toBeLessThan(100);
      await page.screenshot({ path: info.outputPath(`ssh-download-${mode}-progress.png`), animations: 'disabled' });
      await task.getByRole('button', { name: '暂停', exact: true }).click();
      await expect(task).toContainText('已暂停');
      const reads = offsets.length;
      await page.waitForTimeout(400);
      expect(offsets).toHaveLength(reads);
      slow = false;
      await task.getByRole('button', { name: '继续下载', exact: true }).click();
      await expect(task.getByRole('button', { name: '保存到设备', exact: true })).toBeVisible();
      expect(offsets.slice(reads)[0]).toBe(0);
      const saved = page.waitForEvent('download');
      await task.getByRole('button', { name: '保存到设备', exact: true }).click();
      const download = await saved;
      expect(download.suggestedFilename()).toBe('large.bin');
      const chunks: Buffer[] = [];
      for await (const chunk of (await download.createReadStream())!) chunks.push(Buffer.from(chunk));
      expect(Buffer.concat(chunks).equals(bytes)).toBe(true);
      await page.getByRole('button', { name: '切换主题', exact: true }).click();
      await page.screenshot({ path: info.outputPath(`ssh-download-${mode}-ready-dark.png`), animations: 'disabled' });
    });
}
