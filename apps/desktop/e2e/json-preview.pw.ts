import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
});

for (const mode of ['local', 'remote', 'web', 'legacy']) {
  for (const newlines of ['crlf', 'mixed', 'cr']) {
    test(`${mode}: preserves JSON line numbers, navigation and folding with ${newlines} newlines`, async ({ page }) => {
      await page.goto(`e2e/json-preview-harness.html?mode=${mode}&newlines=${newlines}`);
      const preview = page.locator('.json-file-preview');
      await expect(preview.locator('.json-token-property').first()).toBeVisible();
      await expect(preview.locator('.json-preview-info')).toContainText('JSON · 6 行');
      await expect(preview.locator('.cm-line')).toHaveCount(6);
      await expect(preview.locator('.cm-activeLine')).toHaveText('  "last": true');
      await expect(preview.locator('.cm-lineNumbers .cm-activeLineGutter')).toHaveText('5');
      await preview.locator('.cm-lineNumbers .cm-gutterElement').filter({ hasText: /^2$/ }).click();
      await expect(preview.locator('.cm-foldPlaceholder')).toHaveCount(1);
      await expect(preview.locator('.cm-content')).not.toContainText('first-model');
      await expect(preview.locator('.cm-content')).toContainText('"last": true');
      await preview.locator('.cm-foldPlaceholder').click();
      await expect(preview.locator('.cm-content')).toContainText('first-model');
      await expect(preview.locator('.cm-line')).toHaveCount(6);
    });
  }

  test(`${mode}: JSON size setting updates highlighting, persists and keeps the end readable`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`e2e/json-preview-harness.html?mode=${mode}`);
    const input = page.getByRole('spinbutton', { name: 'JSON 高亮大小上限（MB）' });
    const preview = page.locator('.json-file-preview');
    await expect(input).toHaveValue('10');
    await expect(preview.locator('.json-token-property').first()).toBeVisible();
    await expect(preview.locator('.cm-lineNumbers')).toContainText('600');
    expect(await preview.locator('.cm-line').count()).toBeLessThan(200);
    await input.fill('1');
    await expect(preview).toHaveAttribute('data-plain-text', 'true');
    await expect(preview.getByRole('status')).toContainText('超过 1 MB');
    await expect(preview.locator('.json-token-property')).toHaveCount(0);
    await input.fill('20');
    await expect(preview).toHaveAttribute('data-plain-text', 'false');
    await expect(preview.locator('.json-token-property').first()).toBeVisible();
    await page.getByRole('button', { name: 'Last line' }).click();
    await expect(preview.locator('.json-token-property', { hasText: '"last"' })).toBeVisible();
    await preview.getByRole('button', { name: '全部折叠', exact: true }).click();
    await expect(preview.locator('.cm-foldPlaceholder')).toHaveCount(1);
    await preview.getByRole('button', { name: '全部展开', exact: true }).click();
    await page.getByRole('button', { name: 'Last line' }).click();
    await page.screenshot({ path: `../../.codex-tmp/json-preview-${mode}.png` });
    await page.reload();
    await expect(input).toHaveValue('20');
    await page.getByRole('button', { name: 'English', exact: true }).click();
    await expect(page.getByRole('spinbutton', { name: 'JSON highlighting limit (MB)' })).toHaveValue('20');
    await page.getByRole('button', { name: '日本語', exact: true }).click();
    await expect(page.getByRole('spinbutton', { name: 'JSON ハイライトの上限（MB）' })).toHaveValue('20');
  });

  test(`${mode}: folds nested JSON objects and arrays without changing the content`, async ({ page }) => {
    await page.goto(`e2e/json-preview-harness.html?mode=${mode}&nested=1`);
    const preview = page.locator('.json-file-preview');
    await expect(preview.locator('.cm-foldGutter [title="折叠此行"]:visible').first()).toBeVisible();
    const arrayLine = preview.locator('.cm-lineNumbers .cm-gutterElement').filter({ hasText: /^2$/ });
    await arrayLine.click();
    await expect(preview.locator('.cm-foldPlaceholder')).toHaveCount(1);
    await expect(preview.locator('.cm-content')).not.toContainText('first-model');
    await preview.locator('.cm-foldPlaceholder').click();
    await expect(preview.locator('.cm-content')).toContainText('first-model');
    await preview.locator('.cm-foldGutter [title="折叠此行"]:visible').nth(2).click();
    await expect(preview.locator('.cm-content')).not.toContainText('first-model');
    await expect(preview.locator('.cm-content')).toContainText('second-model');
    await preview.getByRole('button', { name: '全部展开', exact: true }).click();
    await expect(preview.locator('.cm-content')).toContainText('first-model');
    await expect(preview.locator('.cm-content')).toHaveAttribute('contenteditable', 'false');
    await page.screenshot({ path: `../../.codex-tmp/json-preview-fold-${mode}.png` });
  });
}

test('10 MB JSON stays responsive and a larger file follows the customized byte limit', async ({ page }) => {
  await page.goto('e2e/json-preview-harness.html?mode=local&mb=10');
  const preview = page.locator('.json-file-preview');
  await expect(preview).toHaveAttribute('data-plain-text', 'false');
  await expect(preview.locator('.json-token-property').first()).toBeVisible();
  await preview.getByRole('button', { name: '全部折叠', exact: true }).click();
  await expect(preview.locator('.cm-foldPlaceholder')).toHaveCount(1);
  await preview.getByRole('button', { name: '全部展开', exact: true }).click();
  await page.getByRole('button', { name: 'Last line' }).click();
  await expect(preview.locator('.json-token-property', { hasText: '"last"' })).toBeVisible();
  await preview.getByRole('button', { name: '全部折叠', exact: true }).click();
  await expect(preview.locator('.cm-foldPlaceholder')).toHaveCount(1);
  await preview.getByRole('button', { name: '全部展开', exact: true }).click();
  await page.goto('e2e/json-preview-harness.html?mode=local&mb=11');
  await expect(preview).toHaveAttribute('data-plain-text', 'true');
  await page.getByRole('spinbutton', { name: 'JSON 高亮大小上限（MB）' }).fill('12');
  await expect(preview).toHaveAttribute('data-plain-text', 'false');
  await expect(preview.locator('.json-token-property').first()).toBeVisible();
});
