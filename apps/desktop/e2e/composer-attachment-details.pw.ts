import { test, expect } from '@playwright/test';

test.describe.configure({ timeout: 90_000 });
const path = 'F:/工作文档/团队资料/周报归档/研发/工作周报_技术研发_赵浩_20261023.docx';
const name = path.split('/').at(-1)!;

for (const mode of ['local', 'remote', 'web']) {
  test(`${mode} composer files have a border and show metadata on demand`, async ({ page }) => {
    const requests: unknown[] = [];
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.route('**/attachments-fixture.json', route => route.fulfill({ json: null }));
    await page.route('**/composer-attachments.json', route => route.fulfill({ json: [
      { kind: 'file', name, path }, { kind: 'file', name: 'upload.txt', path: '', data: 'AAEC/w==' },
    ] }));
    await page.route('**/attachment-metadata.json', route => {
      requests.push(route.request().postDataJSON());
      return route.fulfill({ json: { name, path, size: 12345, directory: false, modifiedAt: 1_700_000_000_000 } });
    });
    await page.goto(`/e2e/message-attachments-harness.html?mode=${mode}&composer`);
    const chip = page.getByRole('button', { name: `查看附件详情：${name}`, exact: true });
    await expect(chip).toBeVisible();
    expect(requests).toEqual([]);
    const capsule = chip.locator('..');
    await expect(capsule).toHaveCSS('border-top-style', 'solid');
    await expect(capsule).toHaveCSS('border-top-width', '1px');
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await chip.click();
      const details = page.locator('.cs-attachment-popover');
      await expect(details.getByText(path, { exact: true })).toBeVisible();
      await expect(details).toContainText('12,345 字节');
      await expect(details).toContainText('修改时间');
      const box = (await details.boundingBox())!;
      expect(box.width).toBeLessThanOrEqual(400);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(await details.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      await page.screenshot({ path: `../../.codex-tmp/composer-attachment-${mode}-${width}.png`, animations: 'disabled' });
      await page.keyboard.press('Escape'); await expect(details).toBeHidden();
    }
    expect(requests).toEqual([{ path, mode }, { path, mode }]);
    await page.getByRole('button', { name: '查看附件详情：upload.txt', exact: true }).click();
    await expect(page.locator('.cs-attachment-popover:visible')).toContainText('4 字节');
    await expect(page.locator('.cs-attachment-popover:visible')).toContainText('发送后可查看保存路径');
    expect(requests).toHaveLength(2);
    await page.getByRole('button', { name: `移除附件：${name}`, exact: true }).click();
    await expect(chip).toHaveCount(0);
  });
}
