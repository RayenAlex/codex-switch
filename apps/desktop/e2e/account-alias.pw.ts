import { expect, test } from '@playwright/test';

for (const mode of ['local', 'remote', 'web']) {
  test(`account alias saves and model labels stay compact in ${mode}`, async ({ page }, info) => {
    await page.setViewportSize({ width: 1100, height: 850 });
    const saved: unknown[] = [];
    await page.exposeFunction('recordAliasSave', (value: unknown) => { saved.push(value); });
    await page.addInitScript(selectedMode => {
      localStorage.setItem('codex-switch:language', 'zh');
      localStorage.setItem('codex-switch.web.session.v1', JSON.stringify({ baseUrl: location.origin,
        accessToken: 'fixture', refreshToken: 'fixture', email: 'fixture@example.test' }));
      if (selectedMode === 'local') Object.assign(window, { __TAURI_INTERNALS__: {
        invoke: async (command: string, args: unknown) => {
          if (command === 'update_account_note') {
            await (window as unknown as { recordAliasSave: (value: unknown) => Promise<void> }).recordAliasSave(args);
          }
        },
      } });
    }, mode);
    await page.route('**/__codex_switch__/api/invoke', async route => {
      const body = route.request().postDataJSON();
      if (body.command === 'update_account_note') saved.push(body.args);
      await route.fulfill({ json: { ok: true, result: null } });
    });
    await page.route('**/sync/accounts/alias-fixture/details', async route => {
      if (route.request().method() === 'PATCH') saved.push(route.request().postDataJSON());
      await route.fulfill({ json: { id: 'alias-fixture', email: 'account@example.test', note: '', expiresAt: '',
        privateDetails: { alias: '', password: '', phoneNumber: '', totpSecret: '' } } });
    });
    await page.goto(`/e2e/account-alias-harness.html?mode=${mode}`, { waitUntil: 'domcontentloaded' });
    const alias = page.getByRole('textbox', { name: '账户别名', exact: true });
    await expect(alias).toBeVisible();
    await alias.fill('工作号');
    await expect(alias).toHaveAttribute('maxlength', '16');
    await page.screenshot({ path: info.outputPath(`alias-${mode}.png`), animations: 'disabled' });
    await page.getByRole('button', { name: mode === 'web' ? '保存账号信息' : '保存资料', exact: true }).click();
    await expect.poll(() => saved.length).toBe(1);
    expect(JSON.stringify(saved[0])).toContain('"alias":"工作号"');
    await expect(alias).toBeHidden();
    const model = page.getByRole('button', { name: /模型与推理强度：gpt-6-luna · 工作号/ });
    await expect(model).toBeVisible();
    expect((await model.boundingBox())!.width).toBeLessThan(340);
    await model.click();
    await page.getByRole('button', { name: '选择模型', exact: true }).click();
    await page.getByRole('menuitemradio', { name: 'gpt-6-luna · 工作号', exact: true }).click();
    await expect(page.getByTestId('selected-model')).toHaveText('gpt-6-luna-account@example.test-9a4ad11234567890');
    await page.screenshot({ path: info.outputPath(`model-${mode}.png`), animations: 'disabled' });
  });
}
