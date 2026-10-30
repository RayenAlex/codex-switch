import { expect, test } from '@playwright/test';
import { checkThreadSidebarResize } from '../../desktop/e2e/thread-sidebar-resize';
import { fixtureUrl, login, navigate, openChatList } from './chat-helpers';

test('web sidebar resizes, remembers its width and restores it after narrow layouts', async ({ page, request }, info) => {
  test.skip(info.project.name !== 'desktop', 'Mouse resizing belongs to the desktop layout');
  await request.post(`${fixtureUrl}/test/reset`);
  await login(page);
  await navigate(page, '聊天');
  await expect(page.getByRole('textbox', { name: '聊天消息' })).toBeVisible();
  await openChatList(page);
  await checkThreadSidebarResize(page);
  const handle = page.getByRole('separator', { name: '调整聊天列表宽度' });
  await page.getByRole('button', { name: '收起聊天列表', exact: true }).click();
  await expect(handle).toHaveCount(0);
  await openChatList(page);
  await expect(handle).toHaveAttribute('aria-valuenow', '520');
  await page.reload();
  await expect(handle).toHaveAttribute('aria-valuenow', '520');
  await page.setViewportSize({ width: 900, height: 900 });
  await expect.poll(async () => Number(await handle.getAttribute('aria-valuenow'))).toBeLessThan(520);
  expect((await page.locator('.chat-conversation').boundingBox())!.width).toBeGreaterThanOrEqual(320);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(900);
  await page.setViewportSize({ width: 390, height: 844 });
  await openChatList(page);
  await expect(page.locator('.chat-drawer')).toBeVisible();
  await expect(handle).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(handle).toHaveAttribute('aria-valuenow', '520');
  await page.screenshot({ path: info.outputPath('web-sidebar-resized.png') });
});

test('chat list has a slim scrollbar and scrolls independently of its controls', async ({ page, isMobile }, info) => {
  const data = Array.from({ length: 24 }, (_, index) => ({
    id: `chat-${index}`, name: `聊天记录 ${index}`, cwd: `/project-${index}`, preview: '', updatedAt: 1,
  }));
  await page.route('**/thread-page?*', route => route.fulfill({ json: { data, nextCursor: null } }));
  await page.goto('./e2e/thread-pagination-harness.html');
  const list = page.locator('.chat-thread-list');
  await expect(list.locator('.chat-thread')).toHaveCount(data.length);
  const scrollbar = await list.evaluate(node => ({
    width: getComputedStyle(node, '::-webkit-scrollbar').width,
    buttons: getComputedStyle(node, '::-webkit-scrollbar-button').display,
    track: getComputedStyle(node, '::-webkit-scrollbar-track').backgroundColor,
  }));
  expect(scrollbar).toEqual({ width: '8px', buttons: 'none', track: 'rgba(0, 0, 0, 0)' });
  const controls = page.locator(isMobile ? '.chat-drawer-footer' : '.chat-sidebar-heading');
  // Finish the drawer's entrance animation before comparing its position.
  await controls.getByRole('button').click({ trial: true });
  const before = await controls.boundingBox();
  await list.evaluate(node => { node.scrollTop = node.scrollHeight; });
  await expect(list.getByRole('button', { name: '聊天记录 23', exact: true })).toBeInViewport();
  expect(await controls.boundingBox()).toEqual(before);
  await expect(page.getByRole('separator', { name: '调整聊天列表宽度' })).toHaveCount(isMobile ? 0 : 1);
  await page.screenshot({ path: info.outputPath('chat-list-scrollbar.png') });
});
