import { expect, test, type Page } from '@playwright/test';

async function open(page: Page, query = 'security&privacy&displays', native = false) {
  await page.goto(`e2e/remote-desktop-harness.html?${query}${native ? '&native-clipboard' : ''}`);
  await launch(page, native);
}

async function launch(page: Page, native: boolean) {
  if (native) await page.getByRole('button', { name: '打开远程桌面', exact: true }).click();
  else {
    await page.getByRole('button', { name: '打开工具', exact: true }).click();
    await page.getByRole('button', { name: '远程桌面', exact: true }).click();
  }
  await expect.poll(() => page.locator('video').evaluate(video => video.videoWidth)).toBeGreaterThan(0);
  await page.getByRole('button', { name: '安全选项', exact: true }).click();
}

for (const native of [false, true]) {
  test(`security controls save acknowledged state and fit the viewport (native=${native})`, async ({ page }, info) => {
    await open(page, undefined, native);
    const panel = page.getByRole('complementary', { name: '安全选项', exact: true });
    await expect(panel.getByRole('switch')).toHaveCount(4);
    await expect(panel.getByRole('switch', { name: '自动解锁被控端' })).toBeDisabled();
    const lock = panel.getByRole('switch', { name: '远程结束后锁屏' });
    const mute = panel.getByRole('switch', { name: '被控端静音运行' });
    await expect(lock).toHaveAttribute('aria-checked', 'false');
    await lock.click(); await expect(lock).toHaveAttribute('aria-checked', 'true');
    await mute.click(); await expect(mute).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: '启用', exact: true }).click();
    await expect(lock).toHaveAttribute('aria-checked', 'true');
    await expect(mute).toHaveAttribute('aria-checked', 'true');
    expect(await page.evaluate(() => window.desktopTest.securityChanges))
      .toEqual([{ lockOnDisconnect: true }, { muteHost: true }]);
    expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    expect((await panel.boundingBox())!.width).toBeLessThanOrEqual(400);
    await panel.getByRole('switch', { name: '同步剪贴板' }).scrollIntoViewIfNeeded();
    await expect(panel.getByRole('switch', { name: '同步剪贴板' })).toBeInViewport();
    await page.screenshot({ path: info.outputPath(`security-${native ? 'desktop' : 'web'}.png`) });
    await page.getByRole('button', { name: '显示', exact: true }).click();
    await expect(panel).not.toBeVisible();
    await page.getByRole('button', { name: '安全选项', exact: true }).click();
    await expect(lock).toHaveAttribute('aria-checked', 'true');
    await page.evaluate(() => { window.desktopTest.securityFail = true; });
    await lock.click();
    await expect(panel.getByRole('alert')).toHaveText('安全选项未能保存，请重试。');
    await expect(lock).toHaveAttribute('aria-checked', 'true');
  });
}

test('legacy hosts show unavailable controls and retain clipboard support', async ({ page }) => {
  await open(page, '');
  for (const name of ['自动解锁被控端', '远程结束后锁屏', '被控端静音运行']) {
    await expect(page.getByRole('switch', { name })).toBeDisabled();
  }
  await expect(page.getByRole('button', { name: '启用', exact: true })).toBeDisabled();
  await expect(page.getByRole('switch', { name: '同步剪贴板' })).toBeEnabled();
});

for (const native of [false, true]) {
  test(`automatic unlock accepts a username without a computer name (native=${native})`, async ({ page }, info) => {
    await open(page, 'security&unlock&privacy', native);
    const toggle = page.getByRole('switch', { name: '自动解锁被控端' });
    await toggle.click();
    const username = page.getByLabel('Windows 账号', { exact: true });
    await expect(username).toHaveAttribute('placeholder', '请输入用户名，无需填写电脑名');
    await page.getByLabel('Windows 登录密码', { exact: true }).fill('fixture-only-password');
    const panel = page.getByRole('complementary', { name: '安全选项' });
    expect((await panel.boundingBox())!.width).toBeLessThanOrEqual(400);
    expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    await page.getByRole('button', { name: '保存并启用' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath(`unlock-form-${native ? 'desktop' : 'web'}.png`) });
    await username.fill('alice');
    await page.getByRole('button', { name: '保存并启用' }).click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByLabel('Windows 登录密码', { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => window.desktopTest.securityChanges)).toEqual([
      { autoUnlock: { enabled: true, username: 'alice', password: 'fixture-only-password' } },
    ]);
    expect(await page.evaluate(() => JSON.stringify(window.desktopTest.security))).not.toContain('fixture-only-password');
    await expect(panel.getByText('已保存在远程电脑，下次连接自动生效。')).toBeInViewport();
    await page.getByRole('switch', { name: '远程结束后锁屏' }).click();
    await page.getByRole('switch', { name: '被控端静音运行' }).click();
    await page.getByRole('switch', { name: '同步剪贴板' }).click();
    await page.getByRole('button', { name: '启用', exact: true }).click();
    await page.getByRole('button', { name: '关闭安全选项' }).click();
    await page.getByRole('button', { name: '关闭', exact: true }).click();
    await expect(page.locator('video')).toHaveCount(0);
    await launch(page, native);
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('switch', { name: '远程结束后锁屏' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('switch', { name: '被控端静音运行' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('switch', { name: '同步剪贴板' })).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByRole('button', { name: '启用', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByLabel('Windows 登录密码', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: '修改登录信息' }).click();
    await expect(page.getByLabel('Windows 登录密码', { exact: true })).toHaveValue('');
    await page.getByLabel('Windows 登录密码', { exact: true }).fill('not-saved');
    await page.getByRole('button', { name: '取消', exact: true }).click();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(await page.evaluate(() => window.desktopTest.securityChanges.at(-1))).toEqual({ autoUnlock: { enabled: false } });
  });

  test(`failed or ignored saves keep the form open and the error visible (native=${native})`, async ({ page }, info) => {
    await open(page, 'security&unlock', native);
    await page.getByRole('switch', { name: '自动解锁被控端' }).click();
    await page.getByLabel('Windows 账号', { exact: true }).fill('PC\\alice');
    for (const failure of ['securityFail', 'securityNoop'] as const) {
      await page.evaluate(key => {
        window.desktopTest.securityFail = false; window.desktopTest.securityNoop = false;
        window.desktopTest[key] = true;
      }, failure);
      await page.getByLabel('Windows 登录密码', { exact: true }).fill('fixture-password');
      await page.getByRole('button', { name: '保存并启用' }).click();
      await expect(page.getByRole('alert')).toHaveText('安全选项未能保存，请重试。');
      await expect(page.getByRole('alert')).toBeInViewport();
      await expect(page.getByLabel('Windows 登录密码', { exact: true })).toHaveValue('');
      await expect(page.getByLabel('Windows 账号', { exact: true })).toHaveValue('PC\\alice');
      await expect(page.getByRole('switch', { name: '自动解锁被控端' })).toHaveAttribute('aria-checked', 'false');
    }
    await page.screenshot({ path: info.outputPath(`unlock-save-error-${native ? 'desktop' : 'web'}.png`) });
  });
}

test('disabled clipboard sync keeps remote shortcuts without reading or writing local content', async ({ page }) => {
  await open(page, 'security&privacy', true);
  await page.getByRole('switch', { name: '同步剪贴板' }).click();
  await expect(page.getByRole('button', { name: '剪贴板', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '关闭安全选项' }).click();
  const before = await page.evaluate(() => window.desktopTest.localClipboard.calls.length);
  await page.locator('.rd-key-capture').focus();
  await page.keyboard.press('Control+c'); await page.keyboard.press('Control+v');
  await expect.poll(() => page.evaluate(() => window.desktopTest.inputs.some(input =>
    input.kind === 'keyboard' && input.code === 'KeyV'))).toBe(true);
  expect(await page.evaluate(() => window.desktopTest.localClipboard.calls.length)).toBe(before);
});
