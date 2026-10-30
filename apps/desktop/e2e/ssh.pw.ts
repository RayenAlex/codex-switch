import { expect, test, type Page } from '@playwright/test';

interface Fixture { host: string; port: number; username: string; password: string; privateKey: string }
test.skip(!process.env.SSH_FIXTURE_CONFIG, 'Requires the disposable WSL SSH fixture, Rust bridge and cloud fixture');
test.use({ actionTimeout: 15_000, screenshot: 'only-on-failure' });

test.beforeEach(async ({ request }) => {
  const reset = await request.post('http://127.0.0.1:1499/fixture/reset', {
    headers: { Authorization: 'Bearer ssh-fixture' },
  });
  expect(reset.ok()).toBe(true);
});

async function connect(page: Page, fixture: Fixture, key = false) {
  await page.getByRole('button', { name: '终端连接选项' }).click();
  await page.getByRole('menuitem', { name: '新建 SSH 连接…' }).click();
  await page.getByLabel('连接名称（可选）').fill('WSL test');
  await page.getByLabel('IP 或主机名').fill(fixture.host);
  await page.getByLabel('端口').fill(String(fixture.port));
  await page.getByLabel('用户名').fill(fixture.username);
  if (key) {
    await page.getByText('私钥登录', { exact: true }).click();
    await page.getByRole('textbox', { name: /私钥$/ }).fill(fixture.privateKey);
  } else await page.getByLabel('密码', { exact: true }).fill(fixture.password);
  await page.getByRole('button', { name: '连接并保存' }).click();
  await expect(page.getByText('首次连接，请核对服务器指纹')).toBeVisible();
  await page.getByRole('button', { name: '信任并连接' }).click();
  await expect(page.getByRole('dialog', { name: 'SSH 连接' })).toBeHidden();
}

async function fileAction(page: Page, name: string, action: string) {
  await page.locator('.ssh-file-list button').filter({ hasText: name }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: action, exact: true }).click();
}

test('phone web: saves SSH to the account and browses files above the terminal drawer', async ({ page, request }, info) => {
  test.setTimeout(90_000);
  const fixture = await (await request.get('http://127.0.0.1:1498/config')).json() as Fixture;
  await request.post('http://127.0.0.1:1498/reset');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/e2e/ssh-harness.html?mode=web');
  await page.getByRole('button', { name: '打开远程终端', exact: true }).click();
  await connect(page, fixture);
  await page.getByRole('button', { name: '远程文件浏览', exact: true }).click();
  const files = page.getByRole('dialog', { name: '远程文件浏览', exact: true });
  await expect(files).toBeVisible();
  await files.getByRole('button', { name: /中文目录/ }).click();
  await expect(files.getByRole('textbox', { name: '远程路径' })).toHaveValue('/中文目录');
  await files.locator('input[type="file"]').setInputFiles({ name: 'phone.txt', mimeType: 'text/plain',
    buffer: Buffer.from('phone upload') });
  await files.getByRole('button', { name: /phone.txt/ }).click();
  await expect(page.getByLabel('文件内容')).toHaveValue('phone upload');
  await page.getByRole('button', { name: '关闭文件', exact: true }).click();
  const download = page.waitForEvent('download');
  await fileAction(page, 'phone.txt', '下载');
  expect((await download).suggestedFilename()).toBe('phone.txt');
  await page.screenshot({ path: info.outputPath('ssh-phone-files.png') });
  await expect(files.getByRole('button', { name: '返回终端' })).toBeInViewport({ ratio: 1 });
  await files.getByRole('button', { name: '返回终端' }).click();
  await expect(files).toBeHidden();
  await expect(page.locator('.xterm-rows').getByText('wsl-ssh>', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '终端连接选项' }).click();
  await expect(page.getByRole('menuitem', { name: 'WSL test' })).toBeVisible();
  await page.getByRole('menuitem', { name: 'WSL test' }).click();
  await expect(page.getByLabel('IP 或主机名')).toHaveCount(0);
  await expect(page.getByLabel('密码', { exact: true })).toHaveValue('');
  await page.screenshot({ path: info.outputPath('ssh-phone-saved.png') });
  await page.getByRole('button', { name: /^取\s*消$/ }).click();
  await page.getByRole('button', { name: '关闭终端 2' }).click();
});

for (const mode of ['local', 'remote', 'web']) {
  test(`${mode}: live WSL SSH terminal and SFTP drawer`, async ({ page, request }, testInfo) => {
    test.setTimeout(90_000);
    const fixture = await (await request.get('http://127.0.0.1:1498/config')).json() as Fixture;
    await request.post('http://127.0.0.1:1498/reset');
    await page.setViewportSize({ width: 1440, height: 920 });
    await page.goto(`/e2e/ssh-harness.html?mode=${mode}`);
    await page.getByRole('button', { name: mode === 'web' ? '打开远程终端' : '打开终端', exact: true }).click();
    await connect(page, fixture, mode === 'remote');
    await expect(page.locator('.xterm-rows').getByText('wsl-ssh>', { exact: false })).toBeVisible();
    const terminal = page.locator('[role="tabpanel"]:visible .xterm-helper-textarea');
    await terminal.focus();
    await page.keyboard.type("printf 'SSH-OK\\n'; stty size"); await page.keyboard.press('Enter');
    await expect(page.locator('.xterm-rows').getByText('SSH-OK', { exact: true })).toBeVisible();
    await page.getByRole('textbox', { name: '聊天输入' }).fill('SSH 运行时可以继续输入');
    await page.getByRole('button', { name: '远程文件浏览', exact: true }).click();
    await expect(page.getByRole('tab', { name: `${fixture.host} 远程文件浏览` })).toBeVisible();
    await expect(page.getByRole('button', { name: /hello.txt/ })).toBeVisible();
    await page.getByRole('button', { name: /中文目录/ }).click();
    await expect(page.getByRole('textbox', { name: '远程路径' })).toHaveValue('/中文目录');
    const fileName = `ssh-${mode}-${Date.now()}.txt`;
    await page.locator('input[type="file"]').setInputFiles({ name: fileName,
      mimeType: 'text/plain', buffer: Buffer.from('WSL upload 中文\n') });
    const file = page.getByRole('button', { name: new RegExp(fileName) });
    await expect(file).toBeVisible(); await file.click();
    await expect(page.getByLabel('文件内容')).toHaveValue('WSL upload 中文\n');
    await page.getByRole('button', { name: '关闭文件', exact: true }).click();
    const download = page.waitForEvent('download');
    await fileAction(page, fileName, '下载');
    const downloaded = await download;
    expect(downloaded.suggestedFilename()).toBe(fileName);
    const data: Buffer[] = [];
    for await (const chunk of (await downloaded.createReadStream())!) data.push(Buffer.from(chunk));
    expect(Buffer.concat(data).toString()).toBe('WSL upload 中文\n');
    await page.getByRole('button', { name: 'English', exact: true }).click();
    await expect(page.getByRole('tab', { name: `${fixture.host} Remote files` })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Upload file', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '中文', exact: true }).click();
    await expect(page.getByRole('tab', { name: `${fixture.host} 远程文件浏览` })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`ssh-${mode}.png`) });
    if (mode !== 'web') {
      await page.getByRole('button', { name: '切换主题' }).click();
      await expect(page.locator('.ssh-file-path')).toHaveCSS('border-color', 'rgb(43, 47, 51)');
      await page.screenshot({ path: testInfo.outputPath(`ssh-${mode}-dark.png`) });
    }
    await page.setViewportSize({ width: 900, height: 700 });
    await expect(page.getByRole('button', { name: '上传文件', exact: true })).toBeVisible();
    await expect(page.locator('.ssh-file-actions')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`ssh-${mode}-narrow.png`) });
    await page.setViewportSize({ width: 1440, height: 920 });
    await fileAction(page, fileName, '重命名');
    await page.getByRole('textbox', { name: '文件名' }).fill(`renamed-${fileName}`);
    await page.getByRole('button', { name: /^确\s*定$/ }).click();
    await fileAction(page, `renamed-${fileName}`, '删除');
    await page.getByRole('dialog', { name: '删除', exact: true }).getByRole('button', { name: /^删\s*除$/ }).click();
    await expect(page.getByRole('button', { name: new RegExp(`renamed-${fileName}`) })).toBeHidden();
    const stored = await page.evaluate(() => localStorage.getItem('remoteai.ssh.profiles.v1'));
    expect(stored).toBeNull();
    const cloud = await request.get('http://127.0.0.1:1499/sync/ssh-profiles', {
      headers: { Authorization: 'Bearer ssh-fixture' },
    });
    const profiles = await cloud.text();
    expect(profiles).toContain(fixture.host); expect(profiles).not.toContain(fixture.password);
    expect(profiles).not.toContain('PRIVATE KEY');
    await page.getByRole('button', { name: '关闭终端 2' }).click();
    await expect(page.getByRole('tab', { name: `${fixture.host} 远程文件浏览` })).toBeHidden();
  });
}
