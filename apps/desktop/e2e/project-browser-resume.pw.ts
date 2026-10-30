import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test, expect } from '@playwright/test';
import type { BrowserHostMessage, BrowserSettings } from '../../../shared/project-browser/nativeBridge';
import type { DocumentsSnapshot } from '../../../shared/project-browser/documents';
import { browserRequest, browserRoot } from './project-browser-fixture';

const require = createRequire(import.meta.url);
const { handleBrowserRequest } = require('../../../shared/project-browser/nativeBridge') as
  typeof import('../../../shared/project-browser/nativeBridge');
const { createProjectBrowserClient } = require('../../../shared/project-browser/protocol') as
  typeof import('../../../shared/project-browser/protocol');

test('native editor checkpoints drafts before close and restores after WebView recreation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  const client = createProjectBrowserClient(browserRequest);
  let snapshot: DocumentsSnapshot | undefined;
  const settings: BrowserSettings = { type: 'settings', cwd: browserRoot, connected: true,
    labels: {}, theme: {}, autoSaveDelay: 0 };
  const emit = (message: BrowserHostMessage) => page.evaluate(value => window.projectBrowserMessage(value), message);
  await page.exposeFunction('nativeBrowserRequest', async (raw: string) => {
    const message = JSON.parse(raw) as { type: string; snapshot?: DocumentsSnapshot; cwd?: string };
    if (message.type === 'ready') { await emit({ ...settings, snapshot }); return; }
    if (message.type === 'snapshot') {
      expect(message.cwd).toBe(browserRoot); snapshot = message.snapshot; return;
    }
    const reply = await handleBrowserRequest(raw, { client, cwd: browserRoot, connected: settings.connected });
    if (reply) await emit(reply);
  });
  await page.addInitScript(() => {
    window.ReactNativeWebView = { postMessage: message => { void window.nativeBrowserRequest(message); } };
  });
  const html = readFileSync(process.env.PROJECT_BROWSER_TEST_ASSET
    ?? new URL('../../native/assets/project-browser.html', import.meta.url), 'utf8');
  await page.route('**/native-resume.html', route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.goto('/native-resume.html');
  await page.getByRole('treeitem', { name: 'src', exact: true }).click();
  await page.getByRole('treeitem', { name: 'main.ts', exact: true }).click();
  const editor = page.getByRole('textbox', { name: '文件内容', exact: true });
  await expect(editor).toContainText('function');
  await editor.fill('unsaved background draft');
  await expect.poll(() => snapshot?.tabs[0]?.text).toBe('unsaved background draft');
  settings.connected = false;
  await emit({ ...settings, snapshot });
  await expect(editor).toBeVisible();
  await expect(editor).toContainText('unsaved background draft');
  // No close handshake: Android may discard the renderer while the app is in the background.
  await page.reload();
  await expect(editor).toContainText('unsaved background draft');
  await expect(page.getByRole('tab', { name: 'main.ts', exact: true }).locator('.pf-dirty-dot')).toBeVisible();
  settings.connected = true;
  await emit({ ...settings, snapshot });
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect.poll(() => snapshot?.tabs[0]?.document?.text).toBe('unsaved background draft');
  await page.screenshot({ path: '../../.codex-tmp/project-browser-resumed-native.png' });
});

test('mobile web keeps editor state, selection and undo through background and reconnect', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto('/e2e/project-browser-harness.html?mode=mobile');
  await page.getByRole('button', { name: '打开工具', exact: true }).click();
  await page.getByRole('button', { name: '文件浏览', exact: true }).click();
  await page.getByRole('treeitem', { name: 'src', exact: true }).click();
  await page.getByRole('treeitem', { name: 'main.ts', exact: true }).click();
  const editor = page.getByRole('textbox', { name: '文件内容', exact: true });
  await expect(editor).toContainText('function');
  await editor.fill('mobile draft');
  await editor.press('End');
  await editor.press('!');
  const caret = await editor.evaluate(() => window.getSelection()?.anchorOffset);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    document.querySelectorAll('button').forEach(button => {
      if (button.textContent === '切换连接') button.click();
    });
  });
  await expect(editor).toContainText('mobile draft!');
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    document.querySelectorAll('button').forEach(button => {
      if (button.textContent === '切换连接') button.click();
    });
  });
  await expect(editor).toBeVisible();
  await expect(editor).toContainText('mobile draft!');
  expect(await editor.evaluate(() => window.getSelection()?.anchorOffset)).toBe(caret);
  await editor.press('Control+z');
  await expect(editor).toContainText('mobile draft');
  await expect(editor).not.toContainText('!');
  await page.screenshot({ path: '../../.codex-tmp/project-browser-resumed-web.png' });
});
