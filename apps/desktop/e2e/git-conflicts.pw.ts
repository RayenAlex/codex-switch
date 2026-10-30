import { expect, test, type Page } from '@playwright/test';

// The local adapter loads the desktop module graph on a cold Vite server.
test.setTimeout(90_000);
test.use({ actionTimeout: 15_000 });

async function openFixture(page: Page, query: string) {
  await page.goto(`/e2e/git-conflicts.html?${query}`);
  // Dynamic native-adapter imports can finish after the document's load event.
  await expect(page.getByTestId('completed')).toBeVisible({ timeout: 60_000 });
}

for (const mode of ['local', 'remote', 'web']) {
  test(`${mode}: merge arrows, manual edits, undo and continuation`, async ({ page }, info) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openFixture(page, `mode=${mode}${mode === 'remote' ? '&dark' : ''}`);
    await page.getByRole('button', { name: '解决冲突', exact: true }).first().click();
    const dialog = page.getByRole('dialog', { name: '解决合并冲突', exact: true });
    const result = dialog.locator('.gm-result .cm-content');
    const save = dialog.getByRole('button', { name: '保存并标记已解决', exact: true });
    await expect(dialog.locator('.cm-editor')).toHaveCount(3);
    await expect(save).toBeDisabled();
    await page.screenshot({ path: info.outputPath(`merge-${mode}.png`), animations: 'disabled' });
    await dialog.getByRole('button', { name: '第 1 处冲突：采用右侧', exact: true }).click();
    await expect(result).toContainText('你好');
    await expect(dialog.getByRole('status')).toHaveText('剩余 1 处冲突');
    await dialog.getByRole('button', { name: '撤销', exact: true }).click();
    await expect(dialog.getByRole('status')).toHaveText('剩余 2 处冲突');
    await expect(result).toContainText('Welcome');
    await dialog.getByRole('button', { name: '重做', exact: true }).click();
    await dialog.getByRole('button', { name: '第 2 处冲突：采用左侧', exact: true }).click();
    await expect(save).toBeEnabled();
    await result.click(); await result.press('Control+End');
    await result.pressSequentially('// reviewed');
    await save.click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId('saved-content')).toHaveText('// Keep the shared header\n'
      + 'export const greeting = "你好";\n\n// Theme configuration\nexport const color = "blue";\n'
      + '// Keep the shared footer\n// reviewed');
    await page.getByRole('button', { name: '继续完成合并', exact: true }).click();
    await expect(page.getByTestId('completed')).toHaveText('true');
  });
}

test('stale saves preserve edits and closing asks before discarding them', async ({ page }) => {
  await openFixture(page, 'stale');
  await page.getByRole('button', { name: '解决冲突', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: '解决合并冲突', exact: true });
  await dialog.getByRole('button', { name: '第 1 处冲突：采用右侧', exact: true }).click();
  await dialog.getByRole('button', { name: '第 2 处冲突：采用左侧', exact: true }).click();
  await dialog.getByRole('button', { name: '保存并标记已解决', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('文件或合并状态已变化');
  await expect(dialog.locator('.gm-result .cm-content')).toContainText('你好');
  await dialog.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.getByText('合并结果尚未保存，确定关闭吗？')).toBeVisible();
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(dialog).toBeVisible();
});

test('deletions are explicit and narrow screens keep the three panes accessible', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFixture(page, 'delete');
  await page.getByRole('button', { name: '解决冲突', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: '解决合并冲突', exact: true });
  await expect(dialog.getByRole('button', { name: '采用右侧', exact: true })).toBeDisabled();
  const box = (await dialog.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(391);
  await page.screenshot({ path: info.outputPath('merge-narrow.png'), animations: 'disabled' });
  await dialog.getByRole('button', { name: '保留删除', exact: true }).click();
  await page.locator('.ant-popconfirm').getByRole('button', { name: '保留删除', exact: true }).click();
  await expect(page.getByTestId('saved-content')).toHaveText('(deleted)');
});

test('offline catalogs translate the editor and unsupported files explain the limitation', async ({ page }) => {
  await openFixture(page, 'rebase');
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.getByRole('button', { name: 'Resolve conflicts', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Resolve merge conflicts', exact: true });
  await expect(dialog.getByText('Target branch version', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Commit being replayed', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Conflict 1: accept right', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('1 conflicts remaining');
  await openFixture(page, 'unsupported');
  await page.getByRole('button', { name: 'Resolve conflicts', exact: true }).first().click();
  await expect(page.getByRole('alert')).toContainText('512 KB');
});
