import { expect, test } from '@playwright/test';

for (const width of [390, 1280]) {
  test(`file conflicts identify tasks and preserve unrelated rollback at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/e2e/git-actions.html?taskConflict');
    await page.getByRole('checkbox', { name: '选择 src/app.ts', exact: true }).check();
    await page.getByRole('button', { name: '回退所选文件', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '回退文件', exact: true });
    await dialog.getByRole('button', { name: '确认回退', exact: true }).click();
    const error = dialog.getByRole('alert');
    await expect(error).toContainText('修复登录页面中的表单验证和提交状态 (task-login) → src/app.ts');
    await expect(error).toContainText('发布任务 (task-release) → src/app.ts');
    await expect(error).not.toContainText('client.gitActivity');
    expect((await dialog.boundingBox())!.width).toBeLessThanOrEqual(400);
    expect(await error.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath('task-file-conflict.png') });
    await dialog.getByRole('button', { name: '取消', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.getByRole('checkbox', { name: '选择 src/app.ts', exact: true }).uncheck();
    await page.getByRole('checkbox', { name: '选择 README.md', exact: true }).check();
    await page.getByRole('button', { name: '回退所选文件', exact: true }).click();
    await dialog.getByRole('button', { name: '确认回退', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: '查看 README.md', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '查看 src/app.ts', exact: true })).toBeVisible();
  });
}
