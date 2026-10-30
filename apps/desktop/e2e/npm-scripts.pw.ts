import { expect, test } from '@playwright/test';

// The first fixture loads both desktop and web workspaces through Vite's development module graph.
test.describe.configure({ timeout: 90_000 });

for (const mode of ['local', 'remote', 'web']) {
  test(`${mode}: npm buttons run, stop, close and reflect completion in bottom terminals`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width: 1440, height: 960 });
    if (mode === 'local') await page.addInitScript(() => Object.assign(window, { __TAURI_INTERNALS__: {} }));
    await page.goto(`/e2e/project-browser-terminal-harness.html?mode=${mode}&scripts=1`);
    await page.getByRole('button', { name: '文件浏览', exact: true }).click();
    await page.getByRole('treeitem', { name: 'package.json', exact: true }).dblclick();
    const editor = page.getByRole('tabpanel', { name: 'package.json', exact: true });
    await expect(editor.locator('.pf-npm-script')).toHaveCount(3);
    const run = () => editor.getByRole('button', { name: '运行 dev', exact: true });
    const stop = () => editor.getByRole('button', { name: '停止 dev', exact: true });
    await expect(run().locator('svg')).toHaveCSS('fill', 'none');
    await expect(run()).toHaveCSS('color', 'rgb(56, 140, 81)');
    await expect(editor.locator('.cm-content .pf-npm-script')).toHaveCount(0);
    await expect(editor.locator('.cm-gutters .pf-npm-script')).toHaveCount(3);
    const lineHeight = await editor.locator('.cm-line').first().evaluate(element => element.getBoundingClientRect().height);
    const scriptHeight = await run().evaluate(element => element.closest('.cm-gutterElement')!.getBoundingClientRect().height);
    expect(Math.abs(scriptHeight - lineHeight)).toBeLessThan(1);
    const numberBounds = (await editor.locator('.cm-lineNumbers').boundingBox())!;
    const buttonBounds = (await run().boundingBox())!;
    const contentBounds = (await editor.locator('.cm-content').boundingBox())!;
    expect(buttonBounds.x).toBeGreaterThanOrEqual(numberBounds.x + numberBounds.width);
    expect(buttonBounds.x + buttonBounds.width).toBeLessThanOrEqual(contentBounds.x);
    await run().click();
    await expect(stop()).toBeVisible();
    await expect(stop().locator('svg')).toHaveCSS('fill', 'rgb(220, 69, 69)');
    const terminal = page.getByRole('region', { name: '终端', exact: true });
    await expect(terminal.getByRole('tab', { name: 'npm run dev', exact: true })).toBeVisible();
    await expect(terminal.locator('.xterm:visible')).toContainText('PS C:/project>');
    const bounds = (await terminal.boundingBox())!;
    expect(Math.round(bounds.y + bounds.height)).toBe(960);
    await page.mouse.move(20, 20);
    await page.screenshot({ path: info.outputPath(`npm-running-${mode}.png`) });
    await stop().click();
    await expect(run()).toBeVisible();
    await expect(page.locator('body')).toHaveAttribute('data-terminal-closes', '1');
    await run().click();
    await expect(stop()).toBeVisible();
    await terminal.getByRole('button', { name: '关闭终端 1', exact: true }).click();
    await expect(run()).toBeVisible();
    await expect(page.locator('body')).toHaveAttribute('data-terminal-closes', '2');
    await editor.getByRole('button', { name: '运行 build', exact: true }).click();
    await expect(editor.getByRole('button', { name: '停止 build', exact: true })).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event('npm-fixture-exit')));
    await expect(editor.getByRole('button', { name: '运行 build', exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath(`npm-finished-${mode}.png`) });
    await page.context().setOffline(true);
    for (const [language, label] of [['en', 'Run dev'], ['ja', 'dev を実行'], ['ru', 'Запустить dev'], ['zh', '运行 dev']]) {
      await page.evaluate(language => {
        const key = 'codex-switch.web.language.v1';
        localStorage.setItem(key, language);
        window.dispatchEvent(new StorageEvent('storage', { key, newValue: language }));
      }, language);
      await expect(editor.getByRole('button', { name: label, exact: true })).toBeVisible();
    }
    await page.context().setOffline(false);
    expect(errors).toEqual([]);
  });

  test(`${mode}: nested packages save edits before launch and recover from startup failure`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    if (mode === 'local') await page.addInitScript(() => Object.assign(window, { __TAURI_INTERNALS__: {} }));
    await page.goto(`/e2e/project-browser-terminal-harness.html?mode=${mode}&scripts=1`);
    await page.getByRole('button', { name: '文件浏览', exact: true }).click();
    await page.getByRole('treeitem', { name: 'src', exact: true }).click();
    await page.locator('[role=treeitem][data-path="C:/project/src/package.json"]').click();
    const editor = page.getByRole('tabpanel', { name: 'package.json', exact: true });
    const content = editor.locator('.cm-content');
    await content.fill('{"scripts":{"dev":"node changed.cjs","failStart":"node missing.cjs"}}');
    await editor.getByRole('button', { name: '运行 dev', exact: true }).click();
    await expect(editor.getByRole('button', { name: '停止 dev', exact: true })).toBeVisible();
    await expect(page.locator('body')).toHaveAttribute('data-script-cwd', 'C:/project/src');
    await expect(page.locator('body')).toHaveAttribute('data-saved-before-run', /node changed.cjs/);
    await editor.getByRole('button', { name: '停止 dev', exact: true }).click();
    await editor.getByRole('button', { name: '运行 failStart', exact: true }).click();
    await expect(editor.getByRole('button', { name: '运行 failStart', exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: '终端', exact: true }).getByRole('alert')
      .or(page.getByRole('region', { name: '终端', exact: true }).getByRole('status'))).toBeVisible();
  });

  test(`${mode}: gutter buttons stay aligned when scrolling, wrapping and folding`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    if (mode === 'local') await page.addInitScript(() => Object.assign(window, { __TAURI_INTERNALS__: {} }));
    await page.goto(`/e2e/project-browser-terminal-harness.html?mode=${mode}&scripts=1`);
    await page.getByRole('button', { name: '文件浏览', exact: true }).click();
    await page.getByRole('treeitem', { name: 'package.json', exact: true }).click();
    const editor = page.getByRole('tabpanel', { name: 'package.json', exact: true });
    await editor.locator('.cm-content').fill(JSON.stringify({ scripts: {
      dev: 'node server.cjs ' + '--long-option=value '.repeat(20), build: 'node build.cjs',
    } }, null, 2));
    const run = editor.getByRole('button', { name: '运行 dev', exact: true });
    const left = (await run.boundingBox())!.x;
    await editor.locator('.cm-scroller').evaluate(element => { element.scrollLeft = 300; });
    expect((await run.boundingBox())!.x).toBe(left);
    await editor.getByRole('button', { name: '自动换行', exact: true }).click();
    const line = editor.locator('.cm-line').filter({ hasText: '--long-option=value' });
    await expect.poll(async () => (await line.boundingBox())!.height).toBeGreaterThan(40);
    expect(Math.abs((await run.boundingBox())!.y - (await line.boundingBox())!.y)).toBeLessThan(2);
    await editor.getByRole('button', { name: '全部折叠', exact: true }).click();
    await expect(editor.locator('.pf-npm-script')).toHaveCount(0);
    await editor.getByRole('button', { name: '全部展开', exact: true }).click();
    await expect(editor.locator('.pf-npm-script')).toHaveCount(2);
    await expect(run).toBeVisible();
  });
}
