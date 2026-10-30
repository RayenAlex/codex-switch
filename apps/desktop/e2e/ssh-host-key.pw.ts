import { expect, test } from '@playwright/test';
import type { SshProfile } from '../../../shared/terminal/sshProfiles';

const oldKey = 'SHA256:oldNakyMCpeFh2x7RehitF9R4Kvmf6C6BJQvGmfgPffS8';
const newKey = 'SHA256:newNakyMCpeFh2x7RehitF9R4Kvmf6C6BJQvGmfgPffS8';
for (const scenario of ['local', 'remote', 'web', 'web-phone']) {
  for (const entry of ['quick', 'edit']) {
    test(`${scenario}: ${entry} confirms and persists the changed host key`, async ({ page }, info) => {
      let profile: SshProfile = { id: 'saved', name: 'Saved server', host: 'saved.test', port: 22,
        username: 'user', auth: 'password', fingerprint: oldKey, revision: 1 };
      const writes: SshProfile[] = [];
      await page.route('http://127.0.0.1:1499/sync/ssh-profiles**', async route => {
        if (route.request().url().endsWith('/credentials')) {
          await route.fulfill({ json: { credentials: { password: 'secret' } } }); return;
        }
        if (route.request().method() === 'PUT') {
          const body = route.request().postDataJSON() as SshProfile;
          writes.push(body); profile = { ...body, revision: (profile.revision ?? 0) + 1 };
        }
        await route.fulfill({ json: [profile] });
      });
      const mode = scenario === 'web-phone' ? 'web' : scenario;
      await page.setViewportSize({ width: scenario === 'web-phone' ? 390 : 1440, height: 920 });
      await page.goto(`/e2e/ssh-harness.html?mode=${mode}&cloud=1&fingerprint=${encodeURIComponent(newKey)}`);
      await page.getByRole('button', { name: mode === 'web' ? '打开远程终端' : '打开终端', exact: true }).click();
      await expect(page.getByRole('tab')).toHaveCount(1);
      const tabs = await page.getByRole('tab').count();
      await page.getByRole('button', { name: '终端连接选项' }).click();
      await page.getByRole('menuitem', { name: entry === 'quick' ? 'Saved server' : '管理 SSH 连接', exact: true }).click();
      if (entry === 'edit') {
        await page.getByRole('button', { name: /Saved server/ }).click();
        await page.getByLabel('连接名称（可选）').fill('Edited server');
        await page.getByRole('button', { name: '测试连接', exact: true }).click();
      }
      const confirmation = page.getByRole('dialog', { name: '服务器指纹已更改', exact: true });
      await expect(confirmation).toContainText(oldKey); await expect(confirmation).toContainText(newKey);
      expect(writes).toHaveLength(0);
      await confirmation.getByRole('button', { name: /^取\s*消$/ }).click();
      expect(writes).toHaveLength(0);
      await page.getByRole('button', { name: entry === 'edit' ? '测试连接' : /^连\s*接$/, exact: true }).click();
      await expect(confirmation).toBeVisible();
      await expect(confirmation).not.toHaveClass(/ant-zoom-(enter|appear)/);
      await page.screenshot({ path: info.outputPath(`${scenario}-${entry}-host-key.png`), animations: 'disabled' });
      const rect = await confirmation.boundingBox(); expect(rect!.width).toBeLessThanOrEqual(400);
      await confirmation.getByRole('button', { name: '确认并更新', exact: true }).click();
      await expect(confirmation).toBeHidden();
      expect(writes).toEqual([expect.objectContaining({ fingerprint: newKey, name: 'Saved server', revision: 1 })]);
      if (entry === 'quick') await expect(page.getByRole('tab')).toHaveCount(tabs + 1);
      else {
        await expect(page.getByText('连接测试成功。')).toBeVisible();
        await expect(page.getByLabel('连接名称（可选）')).toHaveValue('Edited server');
        await page.getByRole('button', { name: /^保\s*存$/ }).click();
        expect(writes.at(-1)).toMatchObject({ name: 'Edited server', fingerprint: newKey, revision: 2 });
      }
    });
  }
}
