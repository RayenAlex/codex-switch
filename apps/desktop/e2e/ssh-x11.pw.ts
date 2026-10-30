import { expect, test, type Page } from '@playwright/test';
import type { SshProfile } from '../../../shared/terminal/sshProfiles';

const saveButton = (page: Page) => page.getByRole('button', { name: /^保\s*存$/ });

async function openProfile(page: Page) {
  await page.getByRole('button', { name: '终端连接选项' }).click();
  await page.getByRole('menuitem', { name: '管理 SSH 连接', exact: true }).click();
  await page.getByRole('button', { name: /X11 server/ }).click();
}

for (const mode of ['local', 'remote', 'web']) {
  test(`${mode}: saves, restores and disables X11 forwarding`, async ({ page }, info) => {
    let profile: SshProfile = { id: 'x11', name: 'X11 server', host: 'saved.test', port: 22,
      username: 'user', auth: 'password', revision: 1 };
    const writes: SshProfile[] = [];
    const prepared: object[] = [];
    await page.route('http://127.0.0.1:1498/rpc', async route => {
      const request = route.request().postDataJSON();
      expect(request.type).toBe('ensureX11');
      prepared.push(request.options);
      await route.fulfill({ json: { data: null } });
    });
    await page.route('http://127.0.0.1:1499/sync/ssh-profiles**', async route => {
      if (route.request().method() === 'PUT') {
        const value = route.request().postDataJSON() as SshProfile;
        writes.push(value); profile = { ...value, revision: (profile.revision ?? 0) + 1 };
      }
      await route.fulfill({ json: [profile] });
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/e2e/ssh-harness.html?mode=${mode}&cloud=1`);
    await page.getByRole('button', { name: mode === 'web' ? '打开远程终端' : '打开终端', exact: true }).click();
    await openProfile(page);
    const checkbox = page.getByRole('checkbox', { name: '启用 X11 转发' });
    await expect(checkbox).not.toBeChecked();
    await checkbox.check();
    const display = page.getByLabel('X11 显示地址（可选）');
    await display.fill('server.test:0');
    await saveButton(page).click();
    await expect(page.getByText('请填写本机 X11 显示地址，例如 :0 或 localhost:0，也可留空自动选择。')).toBeVisible();
    expect(writes).toHaveLength(0);
    await display.fill('localhost:1.2');
    if (mode === 'local') {
      for (const [language, label] of [['English', 'Enable X11 forwarding'],
        ['Русский', 'Включить перенаправление X11'], ['日本語', 'X11 転送を有効にする'], ['中文', '启用 X11 转发']]) {
        await page.getByRole('button', { name: language, exact: true }).evaluate(element => element.click());
        await expect(page.getByRole('checkbox', { name: label })).toBeChecked();
      }
      await page.setViewportSize({ width: 900, height: 700 });
    }
    await page.locator('.ssh-x11-field').scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath(`ssh-x11-${mode}.png`), animations: 'disabled' });
    await saveButton(page).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    expect(writes[0].x11).toEqual({ display: 'localhost:1.2' });
    expect(prepared).toEqual([{ display: 'localhost:1.2' }]);
    await openProfile(page);
    await expect(checkbox).toBeChecked();
    await expect(display).toHaveValue('localhost:1.2');
    await checkbox.uncheck();
    await saveButton(page).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    expect(writes[1]).not.toHaveProperty('x11');
    expect(prepared).toHaveLength(1);
  });

  test(`${mode}: waits for X11, preserves edits after startup failure and retries saving`, async ({ page }, info) => {
    const profile: SshProfile = { id: 'x11', name: 'X11 server', host: 'saved.test', port: 22,
      username: 'user', auth: 'password', revision: 1, x11: {} };
    const writes: SshProfile[] = [];
    let attempts = 0;
    let release!: () => void;
    await page.route('http://127.0.0.1:1498/rpc', async route => {
      expect(route.request().postDataJSON()).toEqual({ type: 'ensureX11', options: {} });
      attempts += 1;
      if (attempts === 1) {
        await new Promise<void>(resolve => { release = resolve; });
        await route.fulfill({ json: { error: 'client.ssh.x11StartFailed' } });
      } else await route.fulfill({ json: { data: null } });
    });
    await page.route('http://127.0.0.1:1499/sync/ssh-profiles**', async route => {
      if (route.request().method() === 'PUT') writes.push(route.request().postDataJSON());
      await route.fulfill({ json: [profile] });
    });
    await page.setViewportSize({ width: mode === 'local' ? 900 : 1280, height: 800 });
    await page.goto(`/e2e/ssh-harness.html?mode=${mode}&cloud=1`);
    await page.getByRole('button', { name: mode === 'web' ? '打开远程终端' : '打开终端', exact: true }).click();
    await openProfile(page);
    await page.getByLabel('名称（可选）').fill('X11 edited');
    await saveButton(page).click();
    await expect(page.getByRole('button', { name: '正在准备 X 服务…' })).toBeDisabled();
    expect(writes).toHaveLength(0);
    await page.screenshot({ path: info.outputPath(`ssh-x11-starting-${mode}.png`), animations: 'disabled' });
    release();
    const message = page.getByRole('alert');
    await expect(message).toContainText('X 服务未能启动，请检查显示地址后重试。');
    expect((await message.boundingBox())?.width).toBeLessThanOrEqual(400);
    await expect(page.getByLabel('名称（可选）')).toHaveValue('X11 edited');
    await page.screenshot({ path: info.outputPath(`ssh-x11-retry-${mode}.png`), animations: 'disabled' });
    await saveButton(page).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    expect(attempts).toBe(2); expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ name: 'X11 edited', x11: {} });
  });
}
