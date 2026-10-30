import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { expect, test, type Page, type Locator } from '@playwright/test';
import type { BrowserHostMessage, BrowserSettings } from '../../../shared/project-browser/nativeBridge';
import { browserRequest, browserRoot } from './project-browser-fixture';
import { longPress } from './project-browser-touch';

const require = createRequire(import.meta.url);
const { handleBrowserRequest } = require('../../../shared/project-browser/nativeBridge') as
  typeof import('../../../shared/project-browser/nativeBridge');
const { createProjectBrowserClient } = require('../../../shared/project-browser/protocol') as
  typeof import('../../../shared/project-browser/protocol');

test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
test.describe.configure({ timeout: 90_000 });

async function nativeBrowser(page: Page) {
  const html = readFileSync(new URL('../../native/assets/project-browser.html', import.meta.url), 'utf8');
  const client = createProjectBrowserClient(browserRequest);
  const settings: BrowserSettings = { type: 'settings', cwd: browserRoot, connected: true, labels: {}, theme: {},
    autoSaveDelay: 0, language: 'zh', capabilities: { reference: false, quoteSelection: false, blame: true } };
  const emit = (message: BrowserHostMessage) => page.evaluate(value => window.projectBrowserMessage(value), message);
  await page.exposeFunction('nativeBrowserRequest', async (raw: string) => {
    const message = JSON.parse(raw) as { type: string };
    if (message.type === 'ready') { await emit(settings); return; }
    const reply = await handleBrowserRequest(raw, { client, cwd: browserRoot, connected: true });
    if (reply) await emit(reply);
  });
  await page.addInitScript(() => {
    window.ReactNativeWebView = { postMessage: raw => { void window.nativeBrowserRequest(raw); } };
  });
  await page.route('**/native-blame.html', route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.goto('/native-blame.html');
}

async function swipeGutter(page: Page, target: Locator) {
  const rect = (await target.boundingBox())!;
  const session = await page.context().newCDPSession(page);
  const point = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove',
    touchPoints: [{ ...point, y: point.y + 60 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await session.detach();
  await page.waitForTimeout(600);
}

for (const mode of ['native', 'mobile web']) {
  test(`${mode}: long press opens and closes blame without folding or trapping scrolling`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    if (mode === 'native') await nativeBrowser(page);
    else {
      await page.goto('/e2e/project-browser-harness.html?mode=mobile');
      await page.getByRole('button', { name: '打开工具', exact: true }).tap();
      await page.getByRole('button', { name: '文件浏览', exact: true }).tap();
    }
    await page.getByRole('treeitem', { name: 'settings.json', exact: true }).tap();
    const editor = page.getByRole('tabpanel', { name: 'settings.json', exact: true });
    const number = editor.locator('.cm-lineNumbers .cm-gutterElement').nth(1);
    await number.tap();
    await expect(editor.locator('.cm-foldPlaceholder')).toHaveCount(1);
    await number.tap();
    await expect(editor.locator('.cm-foldPlaceholder')).toHaveCount(0);
    await longPress(page, number, '显示 Git Blame');
    await expect(editor.locator('.cm-foldPlaceholder')).toHaveCount(0);
    await page.getByRole('menuitemcheckbox', { name: '显示 Git Blame', exact: true }).tap();
    const gutter = editor.locator('.pf-blame-gutter');
    await expect(gutter).toContainText('Alice 中文');
    await longPress(page, gutter.locator('.pf-blame-text').first(), '关闭 Git Blame 批注');
    await expect(editor.getByRole('tooltip')).toBeHidden();
    const menu = page.getByRole('menu', { name: '关闭 Git Blame 批注', exact: true });
    const bounds = (await menu.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
    await page.screenshot({ path: info.outputPath(`git-blame-${mode}-long-press.png`) });
    await menu.getByRole('menuitemcheckbox', { name: '关闭 Git Blame 批注', exact: true }).tap();
    await expect(gutter).toHaveCount(0);
    await expect(editor.locator('.cm-foldPlaceholder')).toHaveCount(0);
    await swipeGutter(page, number);
    await expect(page.getByRole('menu')).toHaveCount(0);
    await longPress(page, number, '显示 Git Blame');
    await expect(page.getByRole('menuitemcheckbox', { name: '显示 Git Blame', exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
}
