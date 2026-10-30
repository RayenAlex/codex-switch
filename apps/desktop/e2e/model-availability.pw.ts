import { test, expect } from '@playwright/test';
import { modelSettingsBackend } from './model-settings-backend';
import { checkModelAvailability } from './model-availability-checks';

test('local composer preserves conversation settings and blocks unavailable models', async ({ page }) => {
  const backend = modelSettingsBackend();
  backend.saved.set('a', { threadId: 'a', revision: 3, selection: { model: 'first', effort: 'xhigh' } });
  backend.saved.set('b', { threadId: 'b', revision: 5, selection: { model: 'first', effort: 'high' } });
  const saved = [...backend.saved];
  await backend.attach(page.context());
  await page.setViewportSize({ width: 1280, height: 900 });
  try {
    await page.goto('/e2e/model-settings-harness.html', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '对话 a', exact: true }).click();
    await checkModelAvailability(page, {
      restrict: async () => {
        backend.availableModels(['second']);
        await page.getByRole('button', { name: '刷新模型', exact: true }).click();
      },
      restore: async () => {
        backend.availableModels();
        await page.getByRole('button', { name: '刷新模型', exact: true }).click();
      }, screenshot: '../../.codex-tmp/model-unavailable-local.png',
    });
    expect([...backend.saved]).toEqual(saved);
    expect(backend.sends).toHaveLength(0);
    await expect(page.getByRole('button', { name: /^模型与推理强度/ })).toHaveText('模型一极高');
  } finally { backend.releaseUsage(); }
});
