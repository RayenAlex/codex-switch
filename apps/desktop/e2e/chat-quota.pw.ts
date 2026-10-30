import { test, expect, type Page, type Locator } from '@playwright/test';

// Loading all three production composers can require a cold Vite transform; assertion timeouts stay unchanged.
test.describe.configure({ timeout: 150_000 });

const entries = ['local', 'remote', 'web'];
const sample = { totalTokens: 476730000, estimatedCostUsd: 696.49,
  primaryRemainingPercent: 74, primaryRemainingAggregated: false, providerEstimatedCost: null,
  estimatedQuota: { remainingUsd: 1193.78, capacityUsd: 1613.21 } };

async function mockUsage(page: Page) {
  page.on('pageerror', error => { throw error; });
  let usage: unknown = sample;
  let pending = false;
  const releases: (() => void)[] = [];
  const requests: string[] = [];
  await page.route('**/__codex_switch__/api/invoke', async route => {
    const { command } = route.request().postDataJSON() as { command: string };
    if (command === 'codex_gui_usage_summary') {
      requests.push(command);
      if (pending) await new Promise<void>(resolve => releases.push(resolve));
    }
    const result = command === 'codex_gui_usage_summary' ? usage : {
      totalOutputTokens: 300, totalOutputTimeMs: 2000, outputRequestCount: 1, estimatedCostUsd: 12.34,
    };
    await route.fulfill({ json: { ok: true, result } });
  });
  return { requests, set: (value: unknown) => { usage = value; },
    pause: () => { pending = true; }, release: () => releases.forEach(resolve => resolve()) };
}

async function assertAccountQuota(section: Locator) {
  const account = section.locator('.quota-account');
  const quota = account.locator('.cs-quota-estimate');
  await expect(quota).toHaveText('1193.78/1613.21USD');
  const bar = account.getByRole('progressbar');
  await expect(bar).toHaveAttribute('aria-valuenow', '74');
  const barBox = (await bar.boundingBox())!;
  const quotaBox = (await quota.boundingBox())!;
  expect(quotaBox.y).toBeGreaterThan(barBox.y + barBox.height);
  const footer = section.locator('[class*="composerHint"], .chat-composer-hint');
  await expect(footer).not.toContainText('74%');
  await expect(footer.locator('.cs-quota-estimate')).toHaveCount(0);
}

for (const width of [1440, 1000]) {
  test(`quota sits below the account progress and usage stays next to the model at ${width}px`, async ({ page }) => {
    await mockUsage(page);
    await page.setViewportSize({ width, height: 1200 });
    await page.goto('/e2e/chat-quota-harness.html', { waitUntil: 'domcontentloaded' });
    for (const name of entries) {
      const section = page.getByTestId(name);
      await assertAccountQuota(section);
      const status = section.getByRole('group', { name: '当前对话用量' });
      await expect(status).toContainText('413.18 K · 12.34 USD');
      await expect(status).not.toContainText('74%');
      await expect(status).not.toContainText('今日');
      await expect(section.locator('.cs-usage-today')).toHaveText('476.73 M · 696.49 USD');
      const daily = section.locator('.cs-daily-usage');
      await expect(daily).toBeVisible();
      const metric = section.getByText(/^[\d.—]+ TTFT$/);
      const metricBox = (await metric.boundingBox())!;
      const dailyBox = (await daily.boundingBox())!;
      expect(dailyBox.x).toBeGreaterThanOrEqual(metricBox.x + metricBox.width);
      expect(Math.abs(dailyBox.y - metricBox.y)).toBeLessThan(3);
      await expect(section.locator('.cs-usage-remaining')).toHaveCount(0);
      await expect(status).not.toContainText('1193.78');
      const model = section.getByRole('button', { name: /GPT-6-Astra/ }).first();
      const statusBox = (await status.boundingBox())!;
      const modelBox = (await model.boundingBox())!;
      expect(Math.abs(statusBox.y + statusBox.height / 2 - modelBox.y - modelBox.height / 2)).toBeLessThan(2);
      expect(modelBox.x - statusBox.x - statusBox.width).toBeGreaterThanOrEqual(0);
      expect(modelBox.x - statusBox.x - statusBox.width).toBeLessThanOrEqual(10);
      expect(statusBox.height).toBeLessThan(30);
      await section.locator('.cs-quota-estimate').hover();
      const tip = page.getByRole('tooltip');
      await expect(tip).toContainText('剩余额度 1193.78 USD / 总额度 1613.21 USD');
      expect((await tip.boundingBox())!.width).toBeLessThanOrEqual(400);
      await page.mouse.move(0, 0);
      await expect(tip).toBeHidden();
    }
    await page.screenshot({ path: `../../.codex-tmp/pc-quota-${width}.png`, fullPage: true });
    await page.evaluate(() => document.documentElement.style.setProperty('--gui-font-size', '18.2px'));
    for (const name of entries) await assertAccountQuota(page.getByTestId(name));
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `../../.codex-tmp/pc-quota-${width}-large.png`, fullPage: true });
    await page.locator('main').evaluate(node => { node.style.maxWidth = '760px'; });
    for (const name of entries) {
      const section = page.getByTestId(name);
      const bounds = (await section.boundingBox())!;
      await expect(section.locator('.cs-daily-usage')).toBeHidden();
      await expect(section.getByText(/^[\d.—]+ TTFT$/)).toBeVisible();
      const box = (await section.locator('.cs-quota-estimate').boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(bounds.x);
      expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width);
    }
    await page.screenshot({ path: `../../.codex-tmp/pc-quota-${width}-compact.png`, fullPage: true });
    await page.locator('main').evaluate(node => { node.style.maxWidth = '1100px'; });
    for (const name of entries) await expect(page.getByTestId(name).locator('.cs-daily-usage')).toBeVisible();
  });
}

test('quota handles unavailable values, languages, polling and unmount without changing the mobile drawer', async ({ page }) => {
  const mock = await mockUsage(page);
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.goto('/e2e/chat-quota-harness.html', { waitUntil: 'domcontentloaded' });
  for (const name of entries) await assertAccountQuota(page.getByTestId(name));
  expect(mock.requests).toHaveLength(4);
  await expect(page.getByTestId('settings').locator('.cs-quota-progress'))
    .toContainText('74% · 1,193.78USD 剩余 · 1,613.21USD 总额度');
  await page.setViewportSize({ width: 390, height: 844 });
  const web = page.getByTestId('web');
  await expect(web.locator('.chat-profile-trigger')).toBeVisible();
  await expect(web.locator('.cs-quota-estimate, .cs-usage-today, .chat-profile-desktop')).toHaveCount(0);
  await expect(page.getByTestId('settings').locator('.cs-quota-progress'))
    .toContainText('74% · 1,193.78USD 剩余 · 1,613.21USD 总额度');
  await page.setViewportSize({ width: 1440, height: 1200 });
  for (const [language, label] of [['en', 'Remaining quota'], ['ru', 'Остаток лимита'], ['ja', '残りの利用枠']]) {
    await page.getByLabel('Language').selectOption(language);
    for (const name of entries) await expect(page.getByTestId(name).locator('.cs-quota-estimate'))
      .toHaveAttribute('aria-label', new RegExp(label));
  }
  mock.set({ ...sample, estimatedQuota: { remainingUsd: 0, capacityUsd: null } });
  for (const name of entries) await expect(page.getByTestId(name).locator('.cs-quota-estimate'))
    .toHaveText('0.00/—USD', { timeout: 10_000 });
  mock.set({ ...sample, primaryRemainingPercent: null });
  for (const name of entries) await expect(page.getByTestId(name).locator('.cs-quota-estimate'))
    .toHaveCount(0, { timeout: 10_000 });
  mock.pause();
  const before = mock.requests.length;
  try {
    await expect.poll(() => mock.requests.length, { timeout: 10_000 }).toBe(before + 4);
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.getByTestId('local')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Open', exact: true })).toBeVisible();
  } finally { mock.release(); }
});
