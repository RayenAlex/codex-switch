import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { expect, test, type Page } from '@playwright/test';
import type { BrowserHostMessage, BrowserSettings } from '../../../shared/project-browser/nativeBridge';
import type { ScriptPanel } from '../../../shared/terminal/TerminalWorkspaceProvider';
import { browserRequest, browserRoot, savedFiles, seedNpmScripts } from './project-browser-fixture';

const require = createRequire(import.meta.url);
const { handleBrowserRequest } = require('../../../shared/project-browser/nativeBridge') as
  typeof import('../../../shared/project-browser/nativeBridge');
const { nativeScriptState, handleNativeScriptAction } = require('../../../shared/project-browser/nativeScripts') as
  typeof import('../../../shared/project-browser/nativeScripts');
const { createProjectBrowserClient } = require('../../../shared/project-browser/protocol') as
  typeof import('../../../shared/project-browser/protocol');

test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
test.describe.configure({ timeout: 120_000 });

async function nativeBrowser(page: Page) {
  seedNpmScripts();
  const client = createProjectBrowserClient(browserRequest);
  const launches: { cwd: string; name?: string; saved?: string }[] = [];
  const closes: string[] = [];
  const panel: ScriptPanel = { tabs: [], busy: false,
    addInDirectory: (cwd, name) => {
      launches.push({ cwd, name, saved: savedFiles.at(-1)?.text });
      panel.tabs.push({ id: String(launches.length), cwd, npmScript: name });
    },
    remove: id => { closes.push(id); panel.tabs = panel.tabs.filter(tab => tab.id !== id); },
  };
  const settings = (): BrowserSettings => ({ type: 'settings', cwd: browserRoot, connected: true,
    labels: {}, theme: {}, language: 'zh', autoSaveDelay: 0, scripts: nativeScriptState(panel),
    capabilities: { reference: false, quoteSelection: false, blame: true } });
  const emit = (message: BrowserHostMessage) => page.evaluate(value => window.projectBrowserMessage(value), message);
  const refresh = () => emit(settings());
  await page.exposeFunction('nativeNpmRequest', async (raw: string) => {
    const message: unknown = JSON.parse(raw);
    if (handleNativeScriptAction(message, { panel, cwd: browserRoot, connected: true })) { await refresh(); return; }
    if (raw.includes('"type":"ready"')) { await refresh(); return; }
    const reply = await handleBrowserRequest(raw, { client, cwd: browserRoot, connected: true });
    if (reply) await emit(reply);
  });
  await page.addInitScript(() => {
    Object.assign(window, { ReactNativeWebView: { postMessage: (raw: string) => {
      const host = window as unknown as { nativeNpmRequest: (raw: string) => Promise<void> };
      void host.nativeNpmRequest(raw);
    } } });
  });
  const html = readFileSync(new URL('../../native/assets/project-browser.html', import.meta.url), 'utf8');
  await page.route('**/native-npm.html', route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.goto('/native-npm.html');
  return { panel, launches, closes, refresh };
}

test('native editor: touch run/stop, save before launch, close and completion updates', async ({ page }, info) => {
  const host = await nativeBrowser(page);
  await page.getByRole('treeitem', { name: 'package.json', exact: true }).tap();
  const editor = page.getByRole('tabpanel', { name: 'package.json', exact: true });
  const run = editor.getByRole('button', { name: '运行 dev', exact: true });
  const stop = editor.getByRole('button', { name: '停止 dev', exact: true });
  await expect(editor.locator('.cm-gutters .pf-npm-script')).toHaveCount(3);
  await run.tap();
  await expect(stop).toBeVisible();
  await expect(stop.locator('svg')).toHaveCSS('fill', 'rgb(220, 69, 69)');
  expect(host.launches).toEqual([{ cwd: browserRoot, name: 'dev', saved: undefined }]);
  await page.screenshot({ path: info.outputPath('npm-native-running.png') });
  await stop.tap();
  await expect(run).toBeVisible();
  expect(host.closes).toEqual(['1']);
  await editor.locator('.cm-content').fill('{"scripts":{"dev":"node changed.cjs"}}');
  await run.tap();
  await expect(stop).toBeVisible();
  expect(host.launches[1].saved).toContain('node changed.cjs');
  host.panel.remove('2'); await host.refresh();
  await expect(run).toBeVisible();
  await run.tap();
  await expect(stop).toBeVisible();
  host.panel.tabs[0].exited = true; await host.refresh();
  await expect(run).toBeVisible();
  expect(await run.evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThanOrEqual(30);
});

test('mobile web: scripts use the bottom drawer and stop on button or terminal close', async ({ page }, info) => {
  await page.goto('/e2e/project-browser-terminal-harness.html?mode=web&scripts=1');
  await page.getByRole('button', { name: '文件浏览', exact: true }).tap();
  await page.getByRole('treeitem', { name: 'package.json', exact: true }).tap();
  const editor = page.getByRole('tabpanel', { name: 'package.json', exact: true });
  const run = editor.getByRole('button', { name: '运行 dev', exact: true });
  const stop = editor.getByRole('button', { name: '停止 dev', exact: true });
  await run.tap();
  const drawer = page.locator('.chat-terminal-drawer');
  await expect(drawer.getByRole('tab', { name: 'npm run dev', exact: true })).toBeVisible();
  await expect(drawer.locator('.xterm:visible')).toContainText('PS C:/project>');
  await expect(drawer.locator('.ant-drawer-content-wrapper')).toHaveCSS('transform', 'none');
  await page.screenshot({ path: info.outputPath('npm-mobile-web-terminal.png') });
  await drawer.getByRole('button', { name: '收起终端', exact: true }).tap();
  await stop.tap();
  await expect(run).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-terminal-closes', '1');
  await run.tap();
  await drawer.getByRole('button', { name: '关闭终端 1', exact: true }).tap();
  await expect(run).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-terminal-closes', '2');
  await editor.getByRole('button', { name: '运行 build', exact: true }).tap();
  await page.evaluate(() => window.dispatchEvent(new Event('npm-fixture-exit')));
  await drawer.getByRole('button', { name: '收起终端', exact: true }).tap();
  await expect(editor.getByRole('button', { name: '运行 build', exact: true })).toBeVisible();
});
