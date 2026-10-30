import { expect, test, type Page, type TestInfo } from '@playwright/test';
import type { SshProfile } from '../../../shared/terminal/sshProfiles';

const privateKey = '-----BEGIN OPENSSH PRIVATE KEY-----\nfixture-key\n-----END OPENSSH PRIVATE KEY-----';
const saveButton = (page: Page) => page.getByRole('button', { name: /^保\s*存$/ });
const connectionDialog = (page: Page) => page.getByRole('dialog', { name: /^管理 SSH 连接/ });

async function openProfile(page: Page, name: string) {
  await page.getByRole('button', { name: '终端连接选项' }).click();
  await page.getByRole('menuitem', { name: '管理 SSH 连接', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(name) }).click();
}

async function mockProfiles(page: Page) {
  let profile: SshProfile = { id: 'saved', name: 'Saved server', host: 'saved.test', port: 22,
    username: 'user', auth: 'key', revision: 1 };
  const writes: SshProfile[] = [];
  await page.route('http://127.0.0.1:1499/sync/ssh-profiles**', async route => {
    if (route.request().url().endsWith('/credentials')) {
      await route.fulfill({ json: { credentials: null } }); return;
    }
    if (route.request().method() === 'PUT') {
      const value = route.request().postDataJSON() as SshProfile;
      writes.push(value); profile = { ...value, revision: (profile.revision ?? 0) + 1 };
    }
    await route.fulfill({ json: [profile] });
  });
  return writes;
}

async function checkAppearance(page: Page, info: TestInfo, scenario: string) {
  await page.screenshot({ path: info.outputPath(`ssh-settings-${scenario}.png`), animations: 'disabled' });
  await page.getByRole('button', { name: '切换主题' }).evaluate(element => element.click());
  if (scenario !== 'web-phone') await page.setViewportSize({ width: 900, height: 700 });
  await page.getByText('连接测试成功。').scrollIntoViewIfNeeded();
  await expect(saveButton(page)).toBeInViewport();
  const feedback = await page.locator('.ssh-dialog .ant-alert-success').boundingBox();
  const actions = await page.locator('.ssh-dialog-actions').boundingBox();
  expect(feedback!.y + feedback!.height).toBeLessThanOrEqual(actions!.y);
  await page.screenshot({ path: info.outputPath(`ssh-settings-${scenario}-dark.png`), animations: 'disabled' });
  for (const [language, label] of [['English', 'Test connection'], ['Русский', 'Проверить подключение'],
    ['日本語', '接続をテスト'], ['中文', '测试连接']]) {
    await page.getByRole('button', { name: language, exact: true }).evaluate(element => element.click());
    await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
  }
}

for (const scenario of ['local', 'remote', 'web', 'web-phone']) {
  const mode = scenario === 'web-phone' ? 'web' : scenario;
  test(`${scenario}: saves edits without keys and tests independently of saving`, async ({ page }, info) => {
    const writes = await mockProfiles(page);
    await page.setViewportSize(scenario === 'web-phone' ? { width: 390, height: 844 } : { width: 1440, height: 920 });
    await page.goto(`/e2e/ssh-harness.html?mode=${mode}&cloud=1`);
    await page.getByRole('button', { name: mode === 'web' ? '打开远程终端' : '打开终端', exact: true }).click();
    await openProfile(page, 'Saved server');
    await expect(page.getByLabel('私钥', { exact: true })).toHaveValue('');
    await page.getByRole('button', { name: '测试连接', exact: true }).click();
    await page.getByRole('button', { name: '信任并测试', exact: true }).click();
    await expect(page.getByText('尚未保存登录信息，请填写密码或私钥。')).toBeVisible();
    await page.getByLabel('连接名称（可选）').fill('Renamed server');
    await saveButton(page).click();
    await expect(connectionDialog(page)).toBeHidden();
    expect(writes).toEqual([{ id: 'saved', name: 'Renamed server', host: 'saved.test', port: 22,
      username: 'user', auth: 'key', revision: 1 }]);

    await openProfile(page, 'Renamed server');
    const tabs = await page.getByRole('tab').count();
    await page.getByLabel('私钥', { exact: true }).fill(privateKey);
    await page.getByRole('button', { name: '测试连接', exact: true }).click();
    await expect(page.getByText('首次连接，请核对服务器指纹')).toBeVisible();
    await page.getByRole('button', { name: '信任并测试', exact: true }).click();
    await expect(page.getByText('连接测试成功。')).toBeVisible();
    await expect(connectionDialog(page)).toBeVisible();
    expect(writes).toHaveLength(1); expect(await page.getByRole('tab').count()).toBe(tabs);
    await checkAppearance(page, info, scenario);
    await page.getByLabel('用户名', { exact: true }).fill('another-user');
    await expect(page.getByText('连接测试成功。')).toBeHidden();
    await saveButton(page).click();
    await expect(connectionDialog(page)).toBeHidden();
    expect(writes[1]).toEqual({ id: 'saved', name: 'Renamed server', host: 'saved.test', port: 22,
      username: 'another-user', auth: 'key', revision: 2, credentials: { privateKey, passphrase: '' } });
  });
}
