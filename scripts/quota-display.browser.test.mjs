import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from '@playwright/test';
import { testBrowserLaunchOptions } from './test-browser.mjs';

test('shared quota toggle persists in desktop and hosted modes with a cloud adaptation', async () => {
  const root = path.resolve(import.meta.dirname, '..');
  const output = path.join(root, '.codex-tmp/quota-display-preview');
  await build({ configFile: false, root, plugins: [react()], logLevel: 'warn',
    build: { outDir: output, emptyOutDir: true, rollupOptions: { input: 'scripts/fixtures/quota-display.html' } } });
  const server = createServer(async (request, response) => {
    try {
      const file = new URL(request.url, 'http://localhost').pathname;
      const contents = await readFile(path.join(output, file));
      const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' };
      response.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' });
      response.end(contents);
    } catch { response.writeHead(404); response.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch(testBrowserLaunchOptions());
  try {
    for (const mode of ['local', 'hosted', 'cloud']) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 500 } });
      await context.addInitScript(mode => {
        const usage = (primary, secondary) => ({
          primary: { remainingPercent: primary, usedPercent: 100 - primary, windowMinutes: 300 },
          secondary: { remainingPercent: secondary, usedPercent: 100 - secondary, windowMinutes: 10080 },
        });
        const calls = [];
        const invoke = async (command, args = {}) => {
          calls.push(command);
          const enabled = localStorage.getItem('quota-average') === 'true';
          if (command === 'get_pet_dock_status') return { enabled: true, showLabels: false, state: 'active' };
          if (command === 'get_quota_display_status') return { enabled,
            average: enabled ? { usage: usage(69, 75), totalAccounts: 3,
              primaryAccounts: 3, secondaryAccounts: 3, stale: false } : null };
          if (command === 'set_quota_display_all_accounts') {
            localStorage.setItem('quota-average', String(args.enabled));
            return { quotaDisplayAllAccounts: args.enabled };
          }
          if (command === 'get_app_settings') return { bubbleStyle: 'classic', bubbleResetDisplay: 'countdown' };
          if (command === 'list_accounts') return [82, 75, 50].map((value, index) => ({
            id: String(index), active: index === 0, usage: usage(value, [78, 75, 72][index]),
          }));
          if (command === 'list_providers') {
            const kind = localStorage.getItem('quota-provider-kind');
            return kind ? [{ id: 'api-1', kind, name: 'API fixture', model: 'test-model',
              active: true, balancePlatform: 'newApi' }] : [];
          }
          if (command === 'query_provider_usage') return usage(43, 54);
          if (command === 'query_provider_balance') return { apiAmount: 123.45, apiUnit: 'USD' };
          if (command === 'list_token_usage_entries_since') return [];
          if (command === 'list_provider_token_usage') return [{ providerId: 'api-1', provider: 'API fixture',
            todayTokens: 1200, totalTokens: 5600 }];
          if (command === 'get_local_proxy_status') {
            const routing = localStorage.getItem('quota-routing');
            return routing === 'unknown' ? null : {
              concurrentAccountRoutingEnabled: false, activeProviderGroup: routing === 'group' ? 'api-group' : null,
            };
          }
          if (command === 'fetch_reset_credits') return { credits: [] };
          return {};
        };
        window.__quotaFixture = { invoke, calls };
        if (mode === 'local') window.__TAURI_INTERNALS__ = {
          invoke, transformCallback: () => 1, unregisterCallback: () => undefined,
        };
      }, mode);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/__codex_switch__/api/invoke', async route => {
        const { command, args } = route.request().postDataJSON();
        const result = await page.evaluate(({ command, args }) => window.__quotaFixture.invoke(command, args),
          { command, args }).catch(async error => {
          if (!error.message.includes('Execution context was destroyed')) throw error;
          await route.abort();
          return undefined;
        });
        if (result === undefined) return;
        await route.fulfill({ json: { ok: true, result } });
      });
      await page.goto(`http://127.0.0.1:${server.address().port}/scripts/fixtures/quota-display.html?mode=${mode}`);
      const toggle = page.locator('#quota-display-all-accounts');
      await toggle.waitFor();
      if (mode === 'cloud') {
        assert.equal(await toggle.isDisabled(), true);
      } else {
        await page.waitForFunction(() => document.querySelector('#quota-display-all-accounts')?.disabled === false);
        assert.equal(await toggle.getAttribute('aria-checked'), 'false');
        await toggle.click();
        await page.waitForFunction(() => document.querySelector('#quota-display-all-accounts')?.getAttribute('aria-checked') === 'true');
        await page.waitForFunction(() => document.querySelector('.floating-usage-window')?.textContent.includes('69%'));
        assert((await page.locator('.floating-usage-window').innerText()).includes('75%'));
        const averageBounds = await toggle.boundingBox();
        const labelBounds = await page.locator('#pet-quota-dock-labels').boundingBox();
        assert(averageBounds.y > labelBounds.y);
        assert(Math.abs(averageBounds.x - labelBounds.x) < 1);
        if (mode === 'local') {
          await page.locator('.settings-card').screenshot({ path: path.join(output, 'pet-three-switches.png') });
          await toggle.locator('../..').screenshot({ path: path.join(output, 'pet-three-switches-detail.png') });
        }
        await page.reload();
        await page.waitForFunction(() => document.querySelector('#quota-display-all-accounts')?.getAttribute('aria-checked') === 'true');
        await page.waitForFunction(() => document.querySelector('.floating-usage-window')?.textContent.includes('69%'));
        for (const language of ['en', 'ru', 'ja', 'zh']) {
          await page.getByLabel('Language', { exact: true }).selectOption(language);
          assert(!(await toggle.locator('..').textContent()).includes('settings.quotaDisplay'));
        }
        await toggle.click();
        await page.waitForFunction(() => document.querySelector('#quota-display-all-accounts')?.getAttribute('aria-checked') === 'false');
        await page.waitForFunction(() => document.querySelector('.floating-usage-window')?.textContent.includes('82%'));
        for (const providerKind of ['custom', 'openai']) {
          await page.evaluate(kind => {
            localStorage.setItem('quota-provider-kind', kind);
            localStorage.setItem('quota-average', 'true');
          }, providerKind);
          await page.reload();
          const expected = providerKind === 'custom' ? 'API fixture' : '43%';
          await page.waitForFunction(text => document.querySelector('.floating-usage-window')?.textContent.includes(text), expected);
          assert.equal(await toggle.getAttribute('aria-checked'), 'true');
          assert(!(await page.locator('.floating-usage-window').innerText()).includes('69%'));
          await toggle.click();
          await page.waitForFunction(() => document.querySelector('#quota-display-all-accounts')?.getAttribute('aria-checked') === 'false');
          assert((await page.locator('.floating-usage-window').innerText()).includes(expected));
          await toggle.click();
          await page.waitForFunction(() => document.querySelector('#quota-display-all-accounts')?.getAttribute('aria-checked') === 'true');
          assert((await page.locator('.floating-usage-window').innerText()).includes(expected));
          await page.evaluate(() => { window.__quotaFixture.calls.length = 0; });
          await page.locator('.floating-usage-window button').focus();
          await page.keyboard.press('Enter');
          const refreshCommand = providerKind === 'custom' ? 'query_provider_balance' : 'query_provider_usage';
          await page.waitForFunction(command => window.__quotaFixture.calls.includes(command), refreshCommand);
          assert(!(await page.evaluate(() => window.__quotaFixture.calls)).includes('refresh_usage'));
        }
        await page.evaluate(() => localStorage.removeItem('quota-provider-kind'));
        for (const routing of ['group', 'unknown']) {
          await page.evaluate(value => localStorage.setItem('quota-routing', value), routing);
          await page.reload();
          await page.waitForFunction(() => document.querySelector('.floating-usage-window')?.textContent.includes('82%'));
          assert.equal(await toggle.getAttribute('aria-checked'), 'true');
          assert(!(await page.locator('.floating-usage-window').innerText()).includes('69%'));
        }
        await page.evaluate(() => localStorage.removeItem('quota-routing'));
        await page.reload();
        await page.waitForFunction(() => document.querySelector('.floating-usage-window')?.textContent.includes('69%'));
      }
      for (const width of [1280, 760]) {
        await page.setViewportSize({ width, height: 700 });
        const overflow = await page.evaluate(() => [...document.querySelectorAll('body *')]
          .filter(node => node.getBoundingClientRect().right > innerWidth + 1)
          .map(node => ({ tag: node.tagName, class: String(node.className), right: node.getBoundingClientRect().right })));
        await page.screenshot({ path: path.join(output, `${mode}-${width}.png`) });
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          `${mode} overflow at ${width}: ${JSON.stringify(overflow.slice(0, 8))}`);
      }
      assert.deepEqual(errors, [], `${mode} browser errors`);
      await context.close();
      console.log(`${mode}: average preference, display and layout verified`);
    }
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
