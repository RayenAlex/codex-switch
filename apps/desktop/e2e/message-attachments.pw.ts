import { test, expect } from '@playwright/test';

// The first navigation compiles the shared desktop and Web message dependency graphs.
test.describe.configure({ timeout: 90_000 });

test.beforeEach(async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
});

const path = 'C:\\Users\\CXR\\AppData\\Roaming\\dev.codex.switch\\codex-gui-workspaces\\attachments\\'
  + '85687b15-c340-4de2-9dd7-ca35461d8a6\\attachment-codex-switch-diagnostics-2026-10-23.jsonl';
const text = `引用对话内容：\n> 先看报错\n\n看看用户反馈的报错\n文件：${path}\n文件夹：/home/user/project`;

for (const mode of ['local', 'remote', 'web']) {
  for (const width of [390, 1280]) {
    test(`${mode} attachment details stay compact at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.route('**/attachments-fixture.json', route => route.fulfill({ json: {
        id: 'user', type: 'userMessage', content: [{ type: 'text', text }],
      } }));
      await page.goto(`/e2e/message-attachments-harness.html?mode=${mode}`);
      const chip = page.getByRole('button', { name: '查看 2 个附件', exact: true });
      await expect(chip).toBeVisible();
      await expect(page.getByText('看看用户反馈的报错', { exact: true })).toBeVisible();
      await expect(page.getByText(path, { exact: true })).toHaveCount(0);
      await chip.hover();
      await expect(page.locator('.cs-message-attachment-preview')).toHaveCount(0);
      await chip.focus(); await page.keyboard.press('Enter');
      const preview = page.locator('.cs-message-attachment-preview');
      await expect(preview.getByText(path, { exact: true })).toBeVisible();
      await expect(preview.getByText('/home/user/project', { exact: true })).toBeVisible();
      const box = (await preview.boundingBox())!;
      expect(box.width).toBeLessThanOrEqual(400);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(await preview.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      await page.screenshot({ path: `../../.codex-tmp/attachments-${mode}-${width}.png`, animations: 'disabled' });
      await page.keyboard.press('Escape');
      await expect(chip).toHaveAttribute('aria-expanded', 'false');
      await expect(preview).toBeHidden();
      await chip.click();
      await page.getByRole('button', { name: 'Theme', exact: true }).click();
      await expect(chip).toHaveAttribute('aria-expanded', 'false');
      await expect(preview).toBeHidden();
      await chip.click();
      await expect(chip).toHaveAttribute('aria-expanded', 'true');
      await expect(preview).toBeVisible();
      await expect(page.locator('.ant-popover:visible')).toHaveCSS('opacity', '1');
      await page.screenshot({ path: `../../.codex-tmp/attachments-${mode}-${width}-dark.png`, animations: 'disabled' });
      await page.keyboard.press('Escape');
      await page.context().setOffline(true);
      for (const [language, label] of [
        ['en', 'View attachments (2)'], ['ja', '2 件の添付を表示'], ['ru', 'Показать вложения (2)'],
      ]) {
        await page.getByRole('button', { name: language, exact: true }).click();
        await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
      }
      await page.context().setOffline(false);
      await page.reload();
      await expect(page.locator('.cs-message-attachment-button')).toHaveAttribute('aria-expanded', 'false');
    });
  }
  test(`${mode} shows file-only live mentions without exposing paths in the bubble`, async ({ page }) => {
    await page.route('**/attachments-fixture.json', route => route.fulfill({ json: {
      id: 'user', type: 'userMessage', localEcho: true, content: [
        { type: 'mention', name: '诊断日志.jsonl', path },
      ],
    } }));
    await page.goto(`/e2e/message-attachments-harness.html?mode=${mode}`);
    const chip = page.getByRole('button', { name: '查看 1 个附件', exact: true });
    await expect(chip).toBeVisible();
    await expect(page.getByText(path, { exact: true })).toHaveCount(0);
    await chip.click();
    await expect(page.locator('.cs-message-attachment-preview')).toContainText('诊断日志.jsonl');
    await expect(page.getByText(path, { exact: true })).toBeVisible();
  });
}
