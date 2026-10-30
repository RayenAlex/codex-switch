import { expect, test, type Page } from '@playwright/test';
import type { SshProfile } from '../../../shared/terminal/sshProfiles';

test.skip(!process.env.SSH_ZMODEM_FIXTURE, 'Requires a disposable lrzsz SSH fixture and bridge on 1518');
test.use({ actionTimeout: 15_000, trace: process.env.ZMODEM_TRACE ? 'on' : 'retain-on-failure',
  screenshot: 'only-on-failure' });
const bridge = 'http://127.0.0.1:1518';
test.beforeEach(async ({ request }) => { await request.post(`${bridge}/reset`); });
const payload = Buffer.from(Array.from({ length: Number(process.env.ZMODEM_TEST_BYTES ?? 1048673) }, (_, index) => index % 256));

async function connect(page: Page, mode: string) {
  const fixture = await (await page.request.get(`${bridge}/config`)).json();
  let profiles: SshProfile[] = [];
  let id = '';
  page.on('response', async response => {
    if (response.url() !== `${bridge}/rpc`) return;
    const body = await response.json();
    if (body.data?.id) id = body.data.id;
  });
  await page.route('http://127.0.0.1:1499/sync/ssh-profiles**', async route => {
    if (route.request().method() === 'PUT') profiles = [{ ...route.request().postDataJSON(), revision: 1 }];
    await route.fulfill({ json: profiles });
  });
  await page.goto(`/e2e/ssh-harness.html?mode=${mode}&bridge=1518`);
  await page.getByRole('button', { name: mode === 'web' ? '打开远程终端' : '打开终端', exact: true }).click();
  await page.getByRole('button', { name: '终端连接选项' }).click();
  await page.getByRole('menuitem', { name: '新建 SSH 连接…' }).click();
  await page.getByLabel('IP 或主机名').fill(fixture.host);
  await page.getByLabel('端口').fill(String(fixture.port));
  await page.getByLabel('用户名', { exact: true }).fill(fixture.username);
  await page.getByLabel('密码', { exact: true }).fill(fixture.password);
  await page.getByRole('button', { name: '连接并保存', exact: true }).click();
  await page.getByRole('button', { name: '信任并连接', exact: true }).click();
  await expect(page.locator('.ssh-dialog')).toBeHidden();
  await expect.poll(() => id).not.toBe('');
  await expect(page.locator('[role=tabpanel]:visible .xterm-rows')).toContainText('wsl-ssh>');
  return id;
}

async function command(page: Page, text: string) {
  await page.locator('[role="tabpanel"]:visible .xterm-helper-textarea').focus();
  await page.keyboard.insertText(text); await page.keyboard.press('Enter');
}

for (const mode of ['local', 'remote', 'web', 'phone']) {
  test(`${mode}: real rz/sz binary batch, cancellation and terminal recovery`, async ({ page }, info) => {
    test.setTimeout(180_000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize(mode === 'phone' ? { width: 390, height: 844 } : { width: 1440, height: 920 });
    const id = await connect(page, mode === 'phone' ? 'web' : mode);
    const name = `二进制-${mode}-${Date.now()}.bin`;
    const emptyName = `empty-${mode}-${Date.now()}.txt`;
    await command(page, 'rz');
    const upload = page.getByRole('dialog', { name: '上传文件', exact: true });
    await expect(upload).toBeVisible();
    await page.screenshot({ path: info.outputPath(`${mode}-rz.png`) });
    const choosing = page.waitForEvent('filechooser');
    await upload.getByRole('button', { name: '选择文件', exact: true }).click();
    const chooser = await choosing;
    // rz normally falls back after a few seconds; explicit selection starts its keepalive handshake.
    if (mode === 'remote') await new Promise(resolve => setTimeout(resolve, 16_000));
    await chooser.setFiles([
      { name, mimeType: 'application/octet-stream', buffer: payload },
      { name: emptyName, mimeType: 'text/plain', buffer: Buffer.alloc(0) },
    ]);
    await expect(upload).toContainText('传输完成。', { timeout: 60_000 });
    await upload.getByRole('button', { name: /^关\s*闭$/ }).click();
    const read = await page.request.post(`${bridge}/rpc`, { data: { type: 'files', id,
      request: { type: 'read', path: name } } });
    expect(Buffer.from((await read.json()).data.data, 'base64').equals(payload)).toBe(true);
    await command(page, `sz '${name}' '${emptyName}'`);
    const download = page.getByRole('dialog', { name: '下载', exact: true });
    await download.getByRole('button', { name: '接收文件', exact: true }).click();
    await expect(download).toContainText('传输完成。', { timeout: 90_000 });
    for (const [fileName, expected] of [[name, payload], [emptyName, Buffer.alloc(0)]] as const) {
      const saving = page.waitForEvent('download');
      await download.getByRole('link', { name: `下载: ${fileName}`, exact: true }).click();
      const saved = await saving;
      expect(saved.suggestedFilename()).toBe(fileName);
      const chunks: Buffer[] = [];
      for await (const chunk of (await saved.createReadStream())!) chunks.push(Buffer.from(chunk));
      expect(Buffer.concat(chunks).equals(expected)).toBe(true);
    }
    await page.screenshot({ path: info.outputPath(`${mode}-sz.png`) });
    await download.getByRole('button', { name: /^关\s*闭$/ }).click();
    await command(page, 'rz');
    await upload.getByRole('button', { name: /^取\s*消$/ }).click();
    await expect(upload).toContainText('传输已取消。');
    await upload.getByRole('button', { name: /^关\s*闭$/ }).click();
    await command(page, "printf 'ZMODEM-RECOVERED\\n'");
    await expect(page.locator('[role=tabpanel]:visible .xterm-rows')).toContainText('ZMODEM-RECOVERED');
    expect(errors).toEqual([]);
  });
}
