import { expect, test, type Page } from '@playwright/test';

const privateKey = '-----BEGIN OPENSSH PRIVATE KEY-----\nfixture-key\n-----END OPENSSH PRIVATE KEY-----';
const saved = { id: 'saved', name: 'Saved server', host: 'saved.test', port: 22,
  username: 'user', auth: 'key', revision: 1 };

async function openKeyForm(page: Page) {
  await page.getByRole('button', { name: '终端连接选项' }).click();
  await page.getByRole('menuitem', { name: '新建 SSH 连接…' }).click();
  await page.getByText('私钥登录', { exact: true }).click();
}

for (const mode of ['local', 'remote', 'web']) {
  test(`${mode}: imports private key files and clears them when changing connections`, async ({ page }, info) => {
    await page.route('http://127.0.0.1:1499/sync/ssh-profiles', route => route.fulfill({ json: [saved] }));
    await page.setViewportSize({ width: mode === 'web' ? 390 : 1440, height: 1000 });
    await page.goto(`/e2e/ssh-harness.html?mode=${mode}&cloud=1`);
    await page.getByRole('button', { name: mode === 'web' ? '打开远程终端' : '打开终端', exact: true }).click();
    await openKeyForm(page);
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: '从文件导入' }).click();
    await (await chooser).setFiles({ name: 'id_ed25519', mimeType: 'application/octet-stream',
      buffer: Buffer.from(privateKey) });
    await expect(page.getByLabel('私钥', { exact: true })).toHaveValue(privateKey);
    await expect(page.getByRole('status')).toHaveText('已导入：id_ed25519');
    const picker = page.locator('input[type="file"]');
    await picker.setInputFiles({ name: 'id_ed25519.pub', mimeType: 'text/plain',
      buffer: Buffer.from('ssh-ed25519 public') });
    await expect(page.getByText('未识别到私钥，请选择 OpenSSH 或 PEM 格式的私钥文件。')).toBeVisible();
    await expect(page.getByLabel('私钥', { exact: true })).toHaveValue(privateKey);
    await picker.setInputFiles({ name: 'large.pem', mimeType: 'text/plain', buffer: Buffer.alloc(65537) });
    await expect(page.getByText('请选择 64 KB 以内的私钥文件。')).toBeVisible();
    await picker.setInputFiles({ name: 'empty.pem', mimeType: 'text/plain', buffer: Buffer.alloc(0) });
    await expect(page.getByText('文件为空，请选择包含私钥的文件。')).toBeVisible();
    await picker.setInputFiles({ name: 'id_ed25519', mimeType: 'text/plain', buffer: Buffer.from(privateKey) });
    await expect(page.getByText('文件为空，请选择包含私钥的文件。')).toBeHidden();
    await page.screenshot({ path: info.outputPath(`ssh-key-import-${mode}.png`), animations: 'disabled' });
    await page.getByRole('button', { name: /^取\s*消$/ }).click();
    await page.getByRole('button', { name: '终端连接选项' }).click();
    await page.getByRole('menuitem', { name: 'Saved server' }).click();
    await expect(page.getByLabel('私钥', { exact: true })).toHaveValue('');
    await expect(page.getByText('已导入：id_ed25519')).toBeHidden();
    await picker.setInputFiles({ name: 'id_ed25519', mimeType: 'text/plain', buffer: Buffer.from(privateKey) });
    await expect(page.getByLabel('私钥', { exact: true })).toHaveValue(privateKey);
    await page.getByRole('button', { name: /^取\s*消$/ }).click();
    await openKeyForm(page);
    await expect(page.getByLabel('私钥', { exact: true })).toHaveValue('');
    await expect(page.getByText('已导入：id_ed25519')).toBeHidden();
  });
}
