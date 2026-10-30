import { expect, test, type Locator, type Page } from '@playwright/test';

const launcherFor = (page: Page) => page.locator('button[aria-controls="remote-ai-help"]');
const storageKey = (page: string) => `codex-switch:help-assistant-position:${page}`;

async function dragTo(page: Page, target: { x: number; y: number }) {
  const bounds = (await launcherFor(page).boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + bounds.width / 2, target.y + bounds.height / 2, { steps: 8 });
  await page.mouse.up();
}

async function expectPosition(launcher: Locator, position: { x: number; y: number }) {
  await expect.poll(async () => {
    const bounds = (await launcher.boundingBox())!;
    return { x: bounds.x, y: bounds.y };
  }).toEqual(position);
}

async function expectWithinViewport(page: Page, element: Locator) {
  const bounds = (await element.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
}

test.beforeEach(async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('**/__codex_switch__/api/invoke', async route => {
    const { command } = route.request().postDataJSON() as { command: string };
    let result: unknown = [];
    if (command === 'remote_ai_help_status') result = { status: 'ready', accountRevision: 1 };
    if (command === 'remote_ai_help_questions') result = null;
    if (command === 'get_proxy_session_unlimited_conversation') result = false;
    if (command === 'codex_gui_events') result = { cursor: { streamId: 'test', sequence: 0 }, events: [] };
    await route.fulfill({ json: { ok: true, result } });
  });
  if (info.project.name === 'desktop') await page.addInitScript(() => {
    Object.assign(window, {
      __TAURI_INTERNALS__: {
        transformCallback: () => 0, unregisterCallback: () => {},
        invoke: async (command: string, args: unknown) => {
          if (command.startsWith('plugin:event|')) return 0;
          const response = await fetch('/__codex_switch__/api/invoke', {
            method: 'POST', body: JSON.stringify({ command, args }),
          });
          return (await response.json()).result;
        },
      },
      __TAURI_EVENT_PLUGIN_INTERNALS__: { unregisterListener: () => {} },
    });
  });
  await page.goto('/e2e/help-assistant-harness.html');
});

test('enlarges the launcher and remembers independent page positions after reload', async ({ page }, info) => {
  const launcher = launcherFor(page);
  const initial = (await launcher.boundingBox())!;
  expect(initial.width).toBe(33); expect(initial.height).toBe(33);
  const accounts = { x: 420, y: 340 };
  await dragTo(page, accounts);
  await expectPosition(launcher, accounts);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await expectPosition(launcher, { x: initial.x, y: initial.y });
  const settings = { x: 900, y: 700 };
  await dragTo(page, settings);
  await page.reload();
  await expectPosition(launcher, accounts);
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await expectPosition(launcher, settings);
  await launcher.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectWithinViewport(page, page.getByRole('dialog'));
  await page.screenshot({ path: info.outputPath('saved-settings-position.png') });
});

test('keeps the launcher and open panel usable at edges and after shrinking the window', async ({ page }, info) => {
  const launcher = launcherFor(page);
  for (const target of [{ x: 8, y: 8 }, { x: 8, y: 950 }, { x: 1390, y: 8 }, { x: 700, y: 480 }]) {
    await dragTo(page, target);
    await expectPosition(launcher, target);
    await launcher.click();
    const panel = page.getByRole('dialog');
    await expect(panel).toBeVisible();
    await expectWithinViewport(page, panel);
    await expect(panel.getByRole('textbox')).toBeInViewport();
    await page.screenshot({ path: info.outputPath(`edge-${target.x}-${target.y}.png`) });
    await launcher.click();
  }
  await dragTo(page, { x: 1380, y: 940 });
  await launcher.click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expectPosition(launcher, { x: 349, y: 803 });
  await expectWithinViewport(page, page.getByRole('dialog'));
  await expect(page.getByRole('textbox')).toBeInViewport();
  await page.screenshot({ path: info.outputPath('resized-panel.png') });
});

test('preserves clicks, keyboard access and the right-click menu without moving', async ({ page }) => {
  const launcher = launcherFor(page);
  const initial = (await launcher.boundingBox())!;
  await page.mouse.move(initial.x + 15, initial.y + 15);
  await page.mouse.down();
  await page.mouse.move(initial.x + 16, initial.y + 16);
  await page.mouse.up();
  await expect(page.getByRole('dialog')).toBeVisible();
  await launcher.click();
  await dragTo(page, { x: 440, y: 320 });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await launcher.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await launcher.click();
  await launcher.click({ button: 'right' });
  await expect(page.getByRole('menuitem', { name: '隐藏助手' })).toBeVisible();
  await expectPosition(launcher, { x: 440, y: 320 });
  await page.keyboard.press('Escape');
  await launcher.click({ button: 'middle' });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expectPosition(launcher, { x: 440, y: 320 });
});

test('recovers from invalid saved positions and unavailable storage', async ({ page }) => {
  const launcher = launcherFor(page);
  await page.evaluate(key => localStorage.setItem(key, '{"x":"invalid","y":null}'), storageKey('accounts'));
  await page.reload();
  await expectWithinViewport(page, launcher);
  await page.evaluate(key => localStorage.setItem(key, '{"x":99999,"y":-99999}'), storageKey('accounts'));
  await page.reload();
  await expectPosition(launcher, { x: 1399, y: 8 });
  await page.evaluate(() => {
    Storage.prototype.setItem = () => { throw new Error('Storage unavailable'); };
  });
  await dragTo(page, { x: 500, y: 300 });
  await expectPosition(launcher, { x: 500, y: 300 });
  await launcher.click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('moves an open panel and restores the launcher after leaving the Codex workspace', async ({ page }) => {
  const launcher = launcherFor(page);
  await launcher.click();
  await page.getByRole('textbox').fill('Keep this draft');
  await dragTo(page, { x: 280, y: 250 });
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveValue('Keep this draft');
  await expectWithinViewport(page, page.getByRole('dialog'));
  await page.getByRole('button', { name: 'Codex', exact: true }).click();
  await expect(launcher).toHaveCount(0);
  await page.getByRole('button', { name: '账户管理', exact: true }).click();
  await expectPosition(launcher, { x: 280, y: 250 });
  await launcher.click();
  await expect(page.getByRole('textbox')).toHaveValue('Keep this draft');
});
