import { testBrowserLaunchOptions } from '../../scripts/test-browser.mjs';
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e', testMatch: 'font-size.pw.ts', workers: 1, timeout: 45_000,
  outputDir: '../../.codex-tmp/font-size-playwright',
  use: {
    launchOptions: testBrowserLaunchOptions(),
    locale: 'zh-CN', headless: true, viewport: { width: 1280, height: 1000 } },
  projects: [
    { name: 'local', use: { baseURL: 'http://127.0.0.1:1494/' } },
    { name: 'remote', use: { baseURL: 'http://127.0.0.1:1494/' } },
    { name: 'web', use: { baseURL: 'http://127.0.0.1:1495/web/' } },
  ],
  webServer: [
    { command: 'npx vite --host 127.0.0.1 --port 1494 --strictPort',
      url: 'http://127.0.0.1:1494', reuseExistingServer: !process.env.CI },
    { command: 'npx vite --config ../web/vite.config.ts --host 127.0.0.1 --port 1495 --strictPort',
      url: 'http://127.0.0.1:1495/web/', reuseExistingServer: !process.env.CI },
  ],
});
