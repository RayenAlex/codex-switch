import { expect, test, type Page } from '@playwright/test';

test.skip(!process.env.SSH_CLOUD_FIXTURE, 'Requires the isolated Go SSH profile fixture on port 1499');
const headers = { Authorization: 'Bearer ssh-fixture' };
const base = 'http://127.0.0.1:1499';

async function openConnections(page: Page, mode: string) {
  await page.goto(`/e2e/ssh-harness.html?mode=${mode}&cloud=1`);
  await page.getByRole('button', { name: mode === 'web' ? '打开远程终端' : '打开终端', exact: true }).click();
  await page.getByRole('button', { name: '终端连接选项' }).click();
}

test('PC local, PC remote, web and phone share the Go server profile list', async ({ browser, request }, info) => {
  test.setTimeout(120_000);
  await request.post(`${base}/fixture/reset`, { headers });
  const contexts = await Promise.all(Array.from({ length: 4 }, () => browser.newContext({ locale: 'zh-CN' })));
  const pages = await Promise.all(contexts.map(context => context.newPage()));
  try {
    const [local, remote, web, phone] = pages;
    await phone.setViewportSize({ width: 390, height: 844 });
    await local.addInitScript(() => localStorage.setItem('remoteai.ssh.profiles.v1', JSON.stringify([
      { id: 'legacy', name: 'Legacy PC', host: 'legacy.test', port: 22, username: 'me', auth: 'password' },
    ])));
    await openConnections(local, 'local');
    await expect(local.getByRole('menuitem', { name: 'Legacy PC' })).toBeVisible();
    expect(await local.evaluate(() => localStorage.getItem('remoteai.ssh.profiles.v1'))).toBeNull();
    await local.getByRole('menuitem', { name: '新建 SSH 连接…' }).click();
    await local.getByLabel('连接名称（可选）').fill('Cloud server');
    await local.getByLabel('IP 或主机名').fill('cloud.test');
    await local.getByLabel('用户名').fill('user');
    await local.getByLabel('密码', { exact: true }).fill('never-store-this');
    await local.getByRole('button', { name: '连接并保存' }).click();
    await local.getByRole('button', { name: '信任并连接' }).click();
    await expect(local.getByRole('dialog', { name: 'SSH 连接' })).toBeHidden();
    for (const [page, mode, label] of [[remote, 'remote', 'pc-remote'], [web, 'web', 'web'],
      [phone, 'web', 'phone']] as const) {
      await openConnections(page, mode);
      await expect(page.getByRole('menuitem', { name: 'Cloud server' })).toBeVisible();
      await page.getByRole('menuitem', { name: '管理 SSH 连接' }).click();
      await page.getByRole('button', { name: /Cloud server/ }).click();
      await expect(page.getByLabel('IP 或主机名')).toHaveValue('cloud.test');
      await expect(page.getByLabel('密码', { exact: true })).toHaveValue('');
      await expect(page.getByLabel('连接名称（可选）')).toBeEnabled();
      await page.screenshot({ path: info.outputPath(`ssh-cloud-${label}.png`), animations: 'disabled' });
    }
    await phone.getByLabel('连接名称（可选）').fill('Edited on phone');
    await phone.getByRole('button', { name: '连接并保存' }).click();
    await expect(phone.getByRole('dialog', { name: 'SSH 连接' })).toBeHidden();
    await remote.getByRole('button', { name: '连接并保存' }).click();
    await expect(remote.getByText('此连接已在其他设备修改或移除，请重新选择后操作。')).toBeVisible();
    await phone.getByRole('button', { name: '终端连接选项' }).click();
    await phone.getByRole('menuitem', { name: '管理 SSH 连接' }).click();
    await phone.getByRole('button', { name: /Edited on phone/ }).click();
    await phone.getByRole('button', { name: /^移\s*除$/ }).click();
    await phone.getByRole('tooltip').getByRole('button', { name: /^移\s*除$/ }).click();
    await expect.poll(async () => (await request.get(`${base}/sync/ssh-profiles`, { headers })).json())
      .toEqual([expect.objectContaining({ id: 'legacy' })]);
    await expect(web.getByText('此连接已在其他设备修改或移除，请重新选择后操作。'))
      .toBeVisible({ timeout: 20_000 });
    const stored = await (await request.get(`${base}/sync/ssh-profiles`, { headers })).text();
    expect(stored).not.toContain('never-store-this');
    await local.getByRole('button', { name: '终端连接选项' }).click();
    await local.getByRole('menuitem', { name: '管理 SSH 连接' }).click();
    await local.getByRole('button', { name: /Legacy PC/ }).click();
    await expect(local.getByLabel('连接名称（可选）')).toBeEnabled();
    await local.screenshot({ path: info.outputPath('ssh-cloud-pc-local.png'), animations: 'disabled' });
  } finally { await Promise.all(contexts.map(context => context.close())); }
});
