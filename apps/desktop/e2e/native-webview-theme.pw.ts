import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { expect, test } from '@playwright/test';
import type { Terminal } from '@xterm/xterm';
const require = createRequire(import.meta.url);
const { terminalAppearance } = require('../../../shared/terminal/theme') as
  typeof import('../../../shared/terminal/theme');
const { themedWebviewDocument } = require('../../../shared/theme/webviewDocument') as
  typeof import('../../../shared/theme/webviewDocument');

declare const terminal: Terminal;
declare const remoteTerminal: (event: object) => void;

for (const mode of ['light', 'dark'] as const) {
  test(`native terminal: ${mode} first paint, live theme and retained output`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const appearance = terminalAppearance(mode === 'dark');
    const source = readFileSync(new URL('../../native/assets/terminal.html', import.meta.url), 'utf8');
    const html = themedWebviewDocument(source, { mode, background: appearance.theme.background,
      foreground: appearance.theme.foreground, variables: appearance.variables });
    await page.route('**/terminal-theme.html', route => route.fulfill({ contentType: 'text/html', body: html }));
    await page.addInitScript(() => Object.assign(window, { ReactNativeWebView: { postMessage: () => {} } }));
    // Verify the document surface even before the emulator or native bridge can execute.
    await page.route('**/terminal-shell.html', route => route.fulfill({ contentType: 'text/html',
      body: html.replace(/<script>[\s\S]*?<\/script>/g, '') }));
    await page.goto('/terminal-shell.html');
    await expect(page.locator('body')).toHaveCSS('background-color',
      mode === 'dark' ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)');
    await page.goto('/terminal-theme.html');
    await page.evaluate(() => new Promise<void>(resolve => terminal.write('Visible 中文\r\n$ command', resolve)));
    for (const theme of [mode, mode === 'dark' ? 'light' : 'dark'] as const) {
      await page.evaluate(theme => remoteTerminal({ type: 'display', wrap: true, shortcuts: true, theme }), theme);
      const dark = theme === 'dark';
      await expect(page.locator('body')).toHaveCSS('background-color', dark ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)');
      await expect(page.locator('.xterm-viewport')).toHaveCSS('background-color',
        dark ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)');
      await expect(page.getByRole('button', { name: 'Ctrl+C' })).toHaveCSS('color',
        dark ? 'rgb(230, 232, 235)' : 'rgb(23, 33, 27)');
      await expect(page.locator('.xterm-rows')).toContainText('Visible 中文');
      expect(await page.evaluate(() => terminal.options.theme?.foreground)).toBe(dark ? '#e5e5e5' : '#242424');
      await page.screenshot({ path: test.info().outputPath(`${theme}-terminal.png`) });
    }
  });

  test(`native files: ${mode} background is ready before the settings handshake`, async ({ page }) => {
    const source = readFileSync(new URL('../../native/assets/project-browser.html', import.meta.url), 'utf8');
    const background = mode === 'dark' ? '#1b201e' : '#ffffff';
    const html = themedWebviewDocument(source, { mode, background, foreground: '#e6e8eb',
      variables: { '--panel': background } });
    await page.addInitScript(() => Object.assign(window, { ReactNativeWebView: { postMessage: () => {} } }));
    await page.route('**/files-theme.html', route => route.fulfill({ contentType: 'text/html', body: html }));
    await page.goto('/files-theme.html');
    await expect(page.locator('body')).toHaveCSS('background-color',
      mode === 'dark' ? 'rgb(27, 32, 30)' : 'rgb(255, 255, 255)');
    await expect(page.locator('html')).toHaveCSS('color-scheme', mode);
    await expect(page.locator('.pf-browser')).toHaveCount(0);
  });
}
