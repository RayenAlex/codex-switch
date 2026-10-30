import { expect, test } from '@playwright/test';

test.skip(!process.env.SSH_CLOUD_FIXTURE, 'Requires the isolated Go SSH profile fixture on port 1499');
const headers = { Authorization: 'Bearer ssh-fixture' };
const base = 'http://127.0.0.1:1499';

for (const scenario of ['local', 'remote', 'web', 'web-phone']) {
  test(`${scenario}: server credentials connect without entering secrets`, async ({ page, request }, info) => {
    await request.post(`${base}/fixture/reset`, { headers });
    const profiles = [
      { id: 'password', name: 'Desktop password', host: 'password.test', auth: 'password',
        credentials: { password: 'fixture-password' } },
      { id: 'key', name: 'Desktop private key', host: 'key.test', auth: 'key',
        credentials: { privateKey: 'fixture-private-key', passphrase: 'fixture-passphrase' } },
    ];
    for (const profile of profiles) {
      const saved = await request.put(`${base}/sync/ssh-profiles/${profile.id}`, { headers,
        data: { ...profile, port: 22, username: 'user', fingerprint: 'SHA256:fixture' } });
      expect(saved.ok()).toBeTruthy();
      expect(await saved.text()).not.toContain('credentials');
    }
    await page.setViewportSize({ width: scenario === 'web-phone' ? 390 : 1440, height: 844 });
    const mode = scenario === 'web-phone' ? 'web' : scenario;
    await page.goto(`/e2e/ssh-harness.html?mode=${mode}&cloud=1`);
    await page.getByRole('button', { name: mode === 'web' ? '打开远程终端' : '打开终端', exact: true }).click();
    await expect(page.getByRole('tab')).toHaveCount(1);
    for (const [index, profile] of profiles.entries()) {
      await page.getByRole('button', { name: '终端连接选项' }).click();
      await page.getByRole('menuitem', { name: profile.name, exact: true }).click();
      await expect(page.getByRole('tab')).toHaveCount(index + 2);
      await expect(page.locator('.ssh-quick-connect')).toHaveCount(0);
      await expect(page.getByLabel('IP 或主机名')).toHaveCount(0);
    }
    await page.screenshot({ path: info.outputPath(`${scenario}-connected.png`), animations: 'disabled' });
    const storage = await page.evaluate(() => JSON.stringify({ ...localStorage }));
    expect(storage).not.toContain('fixture-password');
    expect(storage).not.toContain('fixture-private-key');
  });
}
