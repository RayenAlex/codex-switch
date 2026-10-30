import { expect, test, type Page } from '@playwright/test';

const openMenu = (page: Page, name = '工作电脑') => page.getByRole('button', { name: `${name} 的更多操作` }).click();

test('screen off and restore stay in device management without opening a desktop', async ({ page }, info) => {
  const requests: unknown[] = [];
  await page.route('**/devices/*/screen-power', route => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ status: 204 });
  });
  const sockets: string[] = [];
  page.on('websocket', socket => {
    // Vite's development reload socket is unrelated to device or desktop connections.
    if (new URL(socket.url()).pathname !== '/web/') sockets.push(socket.url());
  });
  await page.goto('e2e/remote-desktop-harness.html?device-screen');
  const url = page.url();
  await openMenu(page);
  await page.getByRole('menuitem', { name: '关闭电脑屏幕' }).click();
  await expect(page.getByText('暂时关闭电脑屏幕？')).toBeVisible();
  await expect(page.getByRole('menu')).not.toBeVisible();
  const drawer = page.locator('.device-screen-sheet .ant-drawer-content');
  await expect.poll(async () => {
    const bounds = (await drawer.boundingBox())!;
    return Math.abs(bounds.y + bounds.height - page.viewportSize()!.height);
  }).toBeLessThan(2);
  const box = (await drawer.boundingBox())!;
  expect(box.width).toBeLessThanOrEqual(440);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(Math.abs(box.y + box.height - page.viewportSize()!.height)).toBeLessThan(2);
  expect((await page.locator('.device-screen-explanation').boundingBox())!.width).toBeLessThanOrEqual(400);
  await expect(page.getByRole('button', { name: '取消', exact: true })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('screen-confirmation.png'), animations: 'disabled' });
  await page.locator('.device-screen-sheet .ant-drawer-close').click();
  await expect(drawer).not.toBeVisible();
  expect(requests).toEqual([]);
  await openMenu(page);
  await page.getByRole('menuitem', { name: '关闭电脑屏幕' }).click();
  await page.getByRole('button', { name: '关闭电脑屏幕', exact: true }).click();
  await expect(page.getByText('已发送关闭屏幕指令')).toBeVisible();
  expect(requests).toEqual([{ action: 'off' }]);
  await expect(page.getByRole('heading', { name: '设备管理', exact: true })).toBeVisible();
  await expect(page.locator('video')).toHaveCount(0);
  await openMenu(page);
  await page.getByRole('menuitem', { name: '恢复电脑屏幕' }).click();
  await expect(page.getByText('已发送恢复显示指令')).toBeVisible();
  expect(requests).toEqual([{ action: 'off' }, { action: 'on' }]);
  expect(page.url()).toBe(url);
  expect(sockets).toEqual([]);
  await expect(page.getByRole('dialog', { name: '远程桌面', exact: true })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('screen-restored.png') });
});

test('offline and unsupported devices cannot send screen commands', async ({ page }) => {
  await page.goto('e2e/remote-desktop-harness.html?device-screen');
  await openMenu(page, '离线电脑');
  await expect(page.getByRole('menuitem', { name: '关闭电脑屏幕' })).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('menuitem', { name: '恢复电脑屏幕' })).toHaveAttribute('aria-disabled', 'true');
  await page.getByRole('heading', { name: '设备管理', exact: true }).click();
  await openMenu(page, 'Mac');
  await expect(page.getByRole('menuitem', { name: '关闭电脑屏幕' })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: '恢复电脑屏幕' })).toHaveCount(0);
});

test('failures remain on the device page and allow retry', async ({ page }) => {
  let fail = true;
  await page.route('**/devices/*/screen-power', route => route.fulfill(fail
    ? { status: 409, json: { message: 'client.deviceScreen.updateRequired' } } : { status: 204 }));
  await page.goto('e2e/remote-desktop-harness.html?device-screen');
  await openMenu(page);
  await page.getByRole('menuitem', { name: '恢复电脑屏幕' }).click();
  await expect(page.getByText('请先更新电脑上的 Remote AI。')).toBeVisible();
  await expect(page.getByRole('heading', { name: '设备管理', exact: true })).toBeVisible();
  fail = false;
  await openMenu(page);
  await page.getByRole('menuitem', { name: '恢复电脑屏幕' }).click();
  await expect(page.getByText('已发送恢复显示指令')).toBeVisible();
  await expect(page.locator('video')).toHaveCount(0);
});
